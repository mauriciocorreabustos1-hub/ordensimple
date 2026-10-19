import "server-only"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { canUseFeature } from "@/lib/plans"
import { canApproveDiscounts } from "@/lib/roles"
import type { SaleInput } from "@/lib/validations"
import type { BusinessContext } from "@/server/session"

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

/** Descuenta stock de las líneas con control de stock y registra el movimiento. */
export async function applyStock(tx: Tx, ctx: BusinessContext, saleId: string, lines: Line[], reason: string) {
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

/** Un descuento aprobado sirve por un rato: si pasan más de 3 horas, hay que pedirlo de nuevo. */
export const DISCOUNT_VALID_MS = 3 * 60 * 60 * 1000

/**
 * Los empleados no pueden cobrar un producto por debajo de su precio: para eso piden un descuento.
 * (El dueño y los administradores sí pueden ajustar precios.)
 */
export function priceBelowList(ctx: BusinessContext, lines: Line[]) {
  if (canApproveDiscounts(ctx.role)) return null
  const low = lines.find((l) => l.listPrice !== null && l.unitPrice < l.listPrice)
  return low ? `No puedes cobrar «${low.description}» por debajo de su precio. Si corresponde, pide un descuento al encargado.` : null
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
