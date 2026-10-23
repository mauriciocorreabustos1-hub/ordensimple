import "server-only"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { canUseFeature } from "@/lib/plans"
import { canApproveDiscounts } from "@/lib/roles"
import type { SaleInput } from "@/lib/validations"
import type { BusinessContext } from "@/server/session"
import { applyPromotions, type AppliedPromo, type PromoRule } from "@/lib/promotions"
import { convert, isRecipeUnit } from "@/lib/recipes"

// Piezas comunes para guardar una venta: las usan las ventas y el cobro de comandas.

export type Tx = Prisma.TransactionClient

export const MAX_TOTAL = 2_000_000_000

/** Busca el cliente por nombre (sin distinguir mayúsculas) o lo crea. */
export async function resolveCustomer(tx: Tx, businessId: string, name: string | undefined) {
  if (!name) return null
  const existing = await tx.customer.findFirst({
    where: { businessId, name: { equals: name, mode: "insensitive" } },
  })
  return existing ? existing.id : (await tx.customer.create({ data: { businessId, name } })).id
}

export type Line = {
  productId: string | null
  description: string
  quantity: number
  unitPrice: number
  unitCost: number
  subtotal: number
  trackStock: boolean
  /** Precio de lista del producto (null si no es un producto guardado). */
  listPrice: number | null
}

/** Valida que los productos sean de este negocio y arma las líneas con su costo. */
export async function buildLines(ctx: BusinessContext, items: SaleInput["items"]): Promise<Line[] | null> {
  const productIds = [...new Set(items.map((i) => i.productId).filter((id): id is string => Boolean(id)))]
  const products = productIds.length
    ? await db.product.findMany({ where: { businessId: ctx.businessId, id: { in: productIds } } })
    : []
  if (products.length !== productIds.length) return null
  const byId = new Map(products.map((p) => [p.id, p]))
  return items.map((item) => {
    const product = item.productId ? byId.get(item.productId) : undefined
    return {
      productId: product?.id ?? null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: product?.cost ?? 0,
      subtotal: item.quantity * item.unitPrice,
      trackStock: product?.trackStock ?? false,
      listPrice: product?.price ?? null,
    }
  })
}

/**
 * Descuenta los materiales de las recetas de los productos vendidos: lo que lleva la receta ÷ lo que rinde × lo vendido.
 * Solo los materiales con stock anotado. Cada descuento queda registrado con la venta, para devolverlo exacto si cambia.
 */
async function consumeMaterials(tx: Tx, ctx: BusinessContext, saleId: string, lines: Line[], reason: string) {
  const sold = new Map<string, number>()
  for (const l of lines) if (l.productId && l.quantity) sold.set(l.productId, (sold.get(l.productId) ?? 0) + l.quantity)
  if (!sold.size) return
  const recipes = await tx.recipe.findMany({
    where: { businessId: ctx.businessId, productId: { in: [...sold.keys()] } },
    include: { items: { include: { material: { select: { id: true, unit: true, stock: true } } } } },
    // Si un producto tiene más de una receta, vale la última que se guardó.
    orderBy: { updatedAt: "desc" },
  })
  const used = new Map<string, number>()
  const done = new Set<string>()
  for (const r of recipes) {
    if (!r.productId || done.has(r.productId)) continue
    done.add(r.productId)
    const units = sold.get(r.productId)! / Math.max(1, r.yieldUnits)
    for (const i of r.items) {
      if (i.material.stock === null || !isRecipeUnit(i.unit) || !isRecipeUnit(i.material.unit)) continue
      const qty = convert(i.quantity, i.unit, i.material.unit)
      if (qty) used.set(i.material.id, (used.get(i.material.id) ?? 0) + qty * units)
    }
  }
  for (const [materialId, qty] of used) {
    await tx.recipeMaterial.update({ where: { id: materialId }, data: { stock: { decrement: qty } } })
    await tx.recipeMaterialMovement.create({ data: { businessId: ctx.businessId, materialId, quantity: -qty, reason, saleId } })
  }
}

/** Devuelve a los materiales lo que una venta había descontado y borra esos registros. */
export async function revertMaterials(tx: Tx, saleId: string) {
  const movements = await tx.recipeMaterialMovement.findMany({ where: { saleId } })
  for (const m of movements) await tx.recipeMaterial.update({ where: { id: m.materialId }, data: { stock: { increment: -m.quantity } } })
  await tx.recipeMaterialMovement.deleteMany({ where: { saleId } })
}

/** Descuenta stock de las líneas con control de stock y registra el movimiento (y los materiales de sus recetas). */
export async function applyStock(tx: Tx, ctx: BusinessContext, saleId: string, lines: Line[], reason: string) {
  await consumeMaterials(tx, ctx, saleId, lines, reason)
  for (const line of lines) {
    if (!line.productId || !line.trackStock) continue
    await tx.product.update({ where: { id: line.productId }, data: { stock: { decrement: line.quantity } } })
    await tx.inventoryMovement.create({
      data: {
        businessId: ctx.businessId,
        productId: line.productId,
        type: "OUT",
        quantity: -line.quantity,
        reason,
        saleId,
        createdById: ctx.user.id,
      },
    })
  }
}

/** Devuelve al stock lo que la venta había descontado y borra esos movimientos. */
export async function revertStock(tx: Tx, saleId: string) {
  await revertMaterials(tx, saleId)
  const movements = await tx.inventoryMovement.findMany({ where: { saleId } })
  for (const m of movements) {
    await tx.product.update({ where: { id: m.productId }, data: { stock: { increment: -m.quantity } } })
  }
  await tx.inventoryMovement.deleteMany({ where: { saleId } })
}

/** Vender al fiado es parte de Pro. Una venta que ya era fiada (de antes) se puede seguir editando. */
export const FIADO_PRO = "Vender al fiado es parte del plan Pro. Puedes contratarlo en Tu plan."
export function fiadoBlocked(ctx: BusinessContext, paymentMethod: string, previous?: string) {
  return paymentMethod === "FIADO" && previous !== "FIADO" && !canUseFeature(ctx.business.plan, "customers")
}

export const lineData = (l: Line) => ({
  productId: l.productId,
  description: l.description,
  quantity: l.quantity,
  unitPrice: l.unitPrice,
  unitCost: l.unitCost,
  subtotal: l.subtotal,
})

// ─── Descuentos ─────────────────────────────────────────────────────────────

/** Empleado de un negocio que exige vender solo productos guardados (lo normal): sin venta rápida ni productos a mano. */
export function productsOnly(ctx: BusinessContext) {
  return !canApproveDiscounts(ctx.role) && ctx.settings.employeesProductsOnly
}

export const QUICK_SALE_BLOCKED = "En este negocio, los empleados registran las ventas con los productos guardados. Usa “Con detalle”."

/** Un empleado restringido no puede agregar productos escritos a mano (con precio libre). */
export function customItemsBlocked(ctx: BusinessContext, items: { productId?: string | null; description: string }[]) {
  if (!productsOnly(ctx)) return null
  const custom = items.find((i) => !i.productId)
  return custom ? `Solo puedes vender productos guardados. Pide al encargado que agregue “${custom.description}” en Productos.` : null
}

/** Un descuento aprobado sirve por un rato: si pasan más de 3 horas, hay que pedirlo de nuevo. */
export const DISCOUNT_VALID_MS = 3 * 60 * 60 * 1000

/**
 * Los empleados no pueden cobrar un producto por debajo de su precio: para eso piden un descuento.
 * (El dueño y los administradores sí pueden ajustar precios.)
 */
export function priceBelowList(ctx: BusinessContext, lines: Line[]) {
  if (canApproveDiscounts(ctx.role)) return null
  const low = lines.find((l) => l.listPrice !== null && l.unitPrice < l.listPrice)
  return low ? `No puedes cobrar “${low.description}” por debajo de su precio. Si corresponde, pide un descuento al encargado.` : null
}

type DiscountInput = { discount?: number; discountReason?: string; discountRequestId?: string }

/**
 * Revisa el descuento de una venta antes de guardarla. Devuelve el monto a restar y una función que deja el
 * registro (quién lo pidió y quién lo aprobó) ligado a la venta, dentro de la misma transacción.
 * - Dueño o administrador: se aplica directo y queda aprobado por él mismo.
 * - Empleado: solo con una solicitud aprobada, suya, por el mismo monto y sobre el mismo total.
 */
export async function checkDiscount(ctx: BusinessContext, input: DiscountInput, subtotal: number, context: string) {
  const discount = input.discount ?? 0
  if (discount <= 0) return { ok: true as const, discount: 0, link: async () => {} }
  if (discount >= subtotal) return { ok: false as const, message: "El descuento no puede ser igual o mayor que el total." }

  if (canApproveDiscounts(ctx.role)) {
    return {
      ok: true as const,
      discount,
      link: async (tx: Tx, saleId: string) => {
        await tx.discountRequest.create({
          data: {
            businessId: ctx.businessId,
            requestedById: ctx.user.id,
            requestedByName: ctx.user.name,
            amount: discount,
            subtotal,
            reason: input.discountReason || "Aplicado por el encargado",
            context,
            status: "USED",
            decidedById: ctx.user.id,
            decidedByName: ctx.user.name,
            decidedAt: new Date(),
            saleId,
          },
        })
      },
    }
  }

  const NEEDS_APPROVAL = "Este descuento necesita la aprobación del encargado. Pídela antes de cobrar."
  if (!input.discountRequestId) return { ok: false as const, message: NEEDS_APPROVAL }
  const request = await db.discountRequest.findFirst({
    where: {
      id: input.discountRequestId,
      businessId: ctx.businessId,
      requestedById: ctx.user.id,
      status: "APPROVED",
      createdAt: { gte: new Date(Date.now() - DISCOUNT_VALID_MS) },
    },
  })
  if (!request) return { ok: false as const, message: NEEDS_APPROVAL }
  if (request.amount !== discount || request.subtotal !== subtotal) {
    return { ok: false as const, message: "La venta cambió desde que se aprobó el descuento. Pide la aprobación de nuevo." }
  }
  return {
    ok: true as const,
    discount,
    link: async (tx: Tx, saleId: string) => {
      // Solo una vez: si dos ventas intentan usar la misma aprobación, la segunda falla.
      const used = await tx.discountRequest.updateMany({ where: { id: request.id, status: "APPROVED" }, data: { status: "USED", saleId } })
      if (used.count !== 1) throw new Error("DISCOUNT_ALREADY_USED")
    },
  }
}

export const DISCOUNT_USED_MESSAGE = "Ese descuento ya se usó en otra venta. Pide uno nuevo."
export const isDiscountUsed = (error: unknown) => error instanceof Error && error.message === "DISCOUNT_ALREADY_USED"

// ─── Promociones automáticas ────────────────────────────────────────────────

/** Promociones activas del negocio (para calcular y para mostrarlas al vender). Sin el plan, ninguna. */
export async function activePromotions(businessId: string, plan: Parameters<typeof canUseFeature>[0]): Promise<PromoRule[]> {
  if (!canUseFeature(plan, "promos")) return []
  const now = new Date()
  return db.promotion.findMany({
    where: { businessId, active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: {
      id: true,
      name: true,
      kind: true,
      percent: true,
      buyQty: true,
      payQty: true,
      scope: true,
      productIds: true,
      categoryId: true,
      startsAt: true,
      endsAt: true,
      weekdays: true,
      fromMinute: true,
      toMinute: true,
      inStore: true,
      online: true,
    },
  })
}

/**
 * Descuento de promociones para las líneas de una venta, calculado en el servidor (lo que vale).
 * `when` es el momento de la venta: así una venta registrada a las 19:00 respeta el happy hour.
 */
export async function promotionsFor(
  ctx: { businessId: string; timezone: string; business: { plan: Parameters<typeof canUseFeature>[0] } },
  lines: Pick<Line, "productId" | "quantity" | "unitPrice">[],
  channel: "store" | "online",
  when = new Date(),
) {
  const rules = await activePromotions(ctx.businessId, ctx.business.plan)
  if (!rules.length) return { discount: 0, applied: [] as AppliedPromo[] }
  const ids = [...new Set(lines.map((l) => l.productId).filter((id): id is string => Boolean(id)))]
  const products = ids.length ? await db.product.findMany({ where: { businessId: ctx.businessId, id: { in: ids } }, select: { id: true, categoryId: true } }) : []
  const category = new Map(products.map((p) => [p.id, p.categoryId]))
  const r = applyPromotions(
    lines.map((l, i) => ({ key: i, productId: l.productId, categoryId: l.productId ? (category.get(l.productId) ?? null) : null, quantity: l.quantity, unitPrice: l.unitPrice })),
    rules,
    { now: when, timezone: ctx.timezone, channel },
  )
  return { discount: r.discount, applied: r.applied }
}

/** Deja registrado cuánto descontó cada promoción en la venta (para los reportes). */
export async function linkPromotions(tx: Tx, saleId: string, applied: AppliedPromo[]) {
  if (!applied.length) return
  await tx.salePromotion.createMany({ data: applied.map((a) => ({ saleId, promotionId: a.promotionId || null, name: a.name.slice(0, 80), amount: a.amount })) })
}
