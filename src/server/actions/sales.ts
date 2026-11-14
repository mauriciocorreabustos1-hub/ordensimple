"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { canApproveDiscounts } from "@/lib/roles"
import { dateKeyToInstant, formatDate, formatTime, toDateKey } from "@/lib/dates"
import { PAYMENT_LABEL } from "@/lib/constants"
import type { SaleReceiptData } from "@/lib/sale-receipt"
import {
  idSchema,
  quickSaleSchema,
  saleSchema,
  type QuickSaleInput,
  type SaleInput,
} from "@/lib/validations"
import {
  applyStock,
  buildLines,
  checkDiscount,
  customItemsBlocked,
  DISCOUNT_USED_MESSAGE,
  FIADO_PRO,
  fiadoBlocked,
  isDiscountUsed,
  lineData,
  quantityError,
  MAX_TOTAL,
  priceBelowList,
  productsOnly,
  QUICK_SALE_BLOCKED,
  resolveCustomer,
  revertMaterials,
  revertStock,
  linkPromotions,
  promotionsFor,
} from "@/server/sale-core"
import { assertCan, requireBusiness, type BusinessContext } from "@/server/session"
import { earnLoyalty, relinkLoyalty, revertLoyalty } from "@/server/loyalty"
import { earnedNote, type LoyaltyEarned } from "@/lib/loyalty"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

function revalidate() {
  revalidatePath("/dashboard", "layout")
}

/**
 * Venta que se guardó sin internet: si ya se subió en un intento anterior, no se vuelve a crear.
 * La hora real (soldAt) se usa solo si es del mismo día elegido y no está en el futuro.
 */
async function alreadySynced(ctx: BusinessContext, clientId: string | undefined) {
  if (!clientId) return false
  return Boolean(await db.sale.findUnique({ where: { businessId_clientId: { businessId: ctx.businessId, clientId } }, select: { id: true } }))
}

function saleDate(key: string, ctx: BusinessContext, soldAt: string | undefined) {
  const at = soldAt ? new Date(soldAt) : null
  if (at && at.getTime() <= Date.now() + 60_000 && toDateKey(at, ctx.timezone) === key) return at
  return resolveDate(key, ctx)
}

const isDuplicate = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && String(error.meta?.target ?? "").includes("clientId")

/** Si la fecha no cambió al editar, se conserva la hora original de la venta. */
function resolveDate(key: string, ctx: BusinessContext, previous?: Date) {
  if (previous && toDateKey(previous, ctx.timezone) === key) return previous
  return dateKeyToInstant(key, ctx.timezone)
}

// ─── Venta rápida ───────────────────────────────────────────────────────────

export async function createQuickSale(input: QuickSaleInput): Promise<ActionResult<{ saleId: string }>> {
  const ctx = await requireBusiness()
  const parsed = quickSaleSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { amount, date, paymentMethod, customerName, note, clientId, soldAt } = parsed.data

  try {
    assertCan(ctx, "sales:create")
    if (productsOnly(ctx)) return { ok: false, message: QUICK_SALE_BLOCKED }
    if (fiadoBlocked(ctx, paymentMethod)) return { ok: false, message: FIADO_PRO }
    if (await alreadySynced(ctx, clientId)) return { ok: true, message: "Venta guardada" }
    let loyal: LoyaltyEarned | null = null
    let saleId = ""
    await db.$transaction(async (tx) => {
      const customerId = await resolveCustomer(tx, ctx.businessId, customerName)
      const sale = await tx.sale.create({
        data: {
          businessId: ctx.businessId,
          clientId,
          date: saleDate(date, ctx, soldAt),
          total: amount,
          paymentMethod,
          isQuick: true,
          note,
          customerId,
          createdById: ctx.user.id,
          items: { create: { description: "Venta rápida", quantity: 1, unitPrice: amount, subtotal: amount } },
        },
        select: { id: true },
      })
      loyal = await earnLoyalty(tx, ctx, sale.id, customerId, amount)
      saleId = sale.id
    })
    revalidate()
    return { ok: true, data: { saleId }, message: (paymentMethod === "FIADO" ? "Venta fiada guardada" : "Venta guardada") + earnedNote(loyal) }
  } catch (error) {
    if (isDuplicate(error)) return { ok: true, message: "Venta guardada" }
    return toActionError(error)
  }
}

export async function updateQuickSale(id: string, input: QuickSaleInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  const parsed = quickSaleSchema.safeParse(input)
  if (!parsedId.success) return { ok: false, message: "Venta no encontrada." }
  if (!parsed.success) return validationError(parsed.error)
  const { amount, date, paymentMethod, customerName, note } = parsed.data

  try {
    assertCan(ctx, "sales:edit")
    const sale = await db.sale.findFirst({ where: { id: parsedId.data, businessId: ctx.businessId } })
    if (sale && fiadoBlocked(ctx, parsed.data.paymentMethod, sale.paymentMethod)) return { ok: false, message: FIADO_PRO }
    if (!sale) return { ok: false, message: "Venta no encontrada." }
    if (!sale.isQuick) return { ok: false, message: "Esta venta tiene detalle de productos." }

    await db.$transaction(async (tx) => {
      const customerId = await resolveCustomer(tx, ctx.businessId, customerName)
      // La tarjeta de fidelidad se recalcula con el monto y el cliente nuevos.
      await relinkLoyalty(tx, ctx, sale.id, customerId, amount)
      await tx.saleItem.deleteMany({ where: { saleId: sale.id } })
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          date: resolveDate(date, ctx, sale.date),
          total: amount,
          paymentMethod,
          note: note ?? null,
          customerId,
          items: { create: { description: "Venta rápida", quantity: 1, unitPrice: amount, subtotal: amount } },
        },
      })
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Venta actualizada" }
}

// ─── Venta con detalle ──────────────────────────────────────────────────────

/** Los datos del comprobante de una venta de este negocio (quien ve la lista de ventas puede verlo). */
export async function getSaleReceipt(id: string): Promise<ActionResult<SaleReceiptData>> {
  const ctx = await requireBusiness()
  if (typeof id !== "string" || !id || id.length > 64) return { ok: false, message: "Venta no encontrada." }
  try {
    const sale = await db.sale.findFirst({
      where: { id, businessId: ctx.businessId },
      include: {
        items: { orderBy: { createdAt: "asc" }, select: { description: true, quantity: true, unit: true, unitPrice: true, subtotal: true } },
        customer: { select: { name: true, phone: true } },
        createdBy: { select: { name: true } },
      },
    })
    if (!sale) return { ok: false, message: "Venta no encontrada." }
    const settings = await db.businessSettings.findUnique({
      where: { businessId: ctx.businessId },
      select: { taxId: true, address: true, contactPhone: true },
    })
    // Las sucursales son negocios del mismo dueño: arriba va el nombre del primero y aparte la sucursal.
    const owner = await db.businessMember.findFirst({ where: { businessId: ctx.businessId, role: "OWNER" }, select: { userId: true } })
    const owned = owner
      ? await db.business.findMany({
          where: { members: { some: { userId: owner.userId, role: "OWNER" } } },
          select: { name: true },
          orderBy: { createdAt: "asc" },
          take: 2,
        })
      : []
    // En la sucursal principal no se repite el mismo nombre dos veces.
    const hasBranches = owned.length > 1
    const brand = hasBranches ? owned[0].name : ctx.business.name
    return {
      ok: true,
      data: {
        code: sale.id.slice(-6).toUpperCase(),
        businessName: brand,
        branchName: brand === ctx.business.name ? null : ctx.business.name,
        taxId: settings?.taxId ?? null,
        address: settings?.address ?? null,
        phone: settings?.contactPhone ?? null,
        dateText: formatDate(sale.date, ctx.timezone, { day: "2-digit", month: "2-digit", year: "numeric" }),
        timeText: formatTime(sale.date, ctx.timezone),
        attendedBy: sale.createdBy?.name ?? null,
        customerName: sale.customer?.name ?? null,
        customerPhone: sale.customer?.phone ?? null,
        items: sale.items,
        promoDiscount: sale.promoDiscount,
        discount: sale.discount,
        tip: sale.tip,
        total: sale.total,
        paymentLabel: PAYMENT_LABEL[sale.paymentMethod],
        isReturn: Boolean(sale.returnOfId),
        currency: ctx.currency,
      },
    }
  } catch (error) {
    return toActionError(error)
  }
}

export async function createSale(input: SaleInput): Promise<ActionResult<{ saleId: string }>> {
  const ctx = await requireBusiness()
  const parsed = saleSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { items, date, paymentMethod, customerName, note, clientId, soldAt } = parsed.data

  try {
    assertCan(ctx, "sales:create")
    if (fiadoBlocked(ctx, paymentMethod)) return { ok: false, message: FIADO_PRO }
    if (await alreadySynced(ctx, clientId)) return { ok: true, message: "Venta guardada" }
    const lines = await buildLines(ctx, items)
    const badQuantity = lines ? quantityError(lines) : null
    if (badQuantity) return { ok: false, message: badQuantity }
    if (!lines) return { ok: false, message: "Uno de los productos ya no existe. Recarga la página." }
    const below = customItemsBlocked(ctx, lines) ?? priceBelowList(ctx, lines)
    if (below) return { ok: false, message: below }
    const subtotal = lines.reduce((sum, l) => sum + l.subtotal, 0)
    if (subtotal > MAX_TOTAL) return { ok: false, message: "El total de la venta es demasiado alto." }
    const when = saleDate(date, ctx, soldAt)
    // Promociones automáticas (2×1, %, happy hour); el descuento manual va sobre lo que queda.
    // Para un empleado, el horario de la promoción se revisa con la hora real (no puede poner una hora pasada
    // para caer en el happy hour); el dueño o un administrador sí puede registrar ventas de otro momento.
    const promo = await promotionsFor(ctx, lines, "store", canApproveDiscounts(ctx.role) ? when : new Date())
    const disc = await checkDiscount(ctx, parsed.data, subtotal - promo.discount, "Venta")
    if (!disc.ok) return { ok: false, message: disc.message }

    let loyal: LoyaltyEarned | null = null
    let saleId = ""
    await db.$transaction(async (tx) => {
      const customerId = await resolveCustomer(tx, ctx.businessId, customerName)
      const sale = await tx.sale.create({
        data: {
          businessId: ctx.businessId,
          clientId,
          date: when,
          total: subtotal - promo.discount - disc.discount,
          discount: disc.discount,
          promoDiscount: promo.discount,
          paymentMethod,
          note,
          customerId,
          createdById: ctx.user.id,
          items: { create: lines.map(lineData) },
        },
      })
      await applyStock(tx, ctx, sale.id, lines, "Venta")
      await linkPromotions(tx, sale.id, promo.applied)
      await disc.link(tx, sale.id)
      loyal = await earnLoyalty(tx, ctx, sale.id, customerId, sale.total)
      saleId = sale.id
    })
    revalidate()
    return { ok: true, data: { saleId }, message: (paymentMethod === "FIADO" ? "Venta fiada guardada" : "Venta guardada") + earnedNote(loyal) }
  } catch (error) {
    if (isDuplicate(error)) return { ok: true, message: "Venta guardada" }
    if (isDiscountUsed(error)) return { ok: false, message: DISCOUNT_USED_MESSAGE }
    return toActionError(error)
  }
}

export async function updateSale(id: string, input: SaleInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  const parsed = saleSchema.safeParse(input)
  if (!parsedId.success) return { ok: false, message: "Venta no encontrada." }
  if (!parsed.success) return validationError(parsed.error)
  const { items, date, paymentMethod, customerName, note } = parsed.data

  try {
    assertCan(ctx, "sales:edit")
    const sale = await db.sale.findFirst({ where: { id: parsedId.data, businessId: ctx.businessId } })
    if (sale && fiadoBlocked(ctx, parsed.data.paymentMethod, sale.paymentMethod)) return { ok: false, message: FIADO_PRO }
    if (!sale) return { ok: false, message: "Venta no encontrada." }
    if (sale.returnOfId) return { ok: false, message: "Una devolución no se edita. Si te equivocaste, elimínala y hazla de nuevo." }
    if (await db.sale.count({ where: { returnOfId: sale.id } })) {
      return { ok: false, message: "Esta venta tiene devoluciones, así que no se puede editar. Si es necesario, elimina primero la devolución." }
    }
    if (await db.saleReturn.count({ where: { saleId: sale.id, status: "PENDING" } })) {
      return { ok: false, message: "Esta venta tiene una devolución esperando aprobación. Apruébala o recházala antes de editarla." }
    }
    const lines = await buildLines(ctx, items)
    const badQuantity = lines ? quantityError(lines) : null
    if (badQuantity) return { ok: false, message: badQuantity }
    if (!lines) return { ok: false, message: "Uno de los productos ya no existe. Recarga la página." }
    // Las promociones se recalculan con los productos nuevos (según el momento de la venta).
    // Si la venta tenía un descuento aprobado, se mantiene.
    const newDate = resolveDate(date, ctx, sale.date)
    const promo = await promotionsFor(ctx, lines, "store", newDate)
    const total = lines.reduce((sum, l) => sum + l.subtotal, 0) - promo.discount - sale.discount
    if (total > MAX_TOTAL) return { ok: false, message: "El total de la venta es demasiado alto." }
    if (total <= 0) return { ok: false, message: "Con el descuento que tiene esta venta, el total quedaría en cero. Revisa los productos." }

    await db.$transaction(async (tx) => {
      // Se deshace el stock de la versión anterior y se aplica el de la nueva.
      await revertStock(tx, sale.id)
      await tx.saleItem.deleteMany({ where: { saleId: sale.id } })
      await tx.salePromotion.deleteMany({ where: { saleId: sale.id } })
      const customerId = await resolveCustomer(tx, ctx.businessId, customerName)
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          date: newDate,
          total,
          promoDiscount: promo.discount,
          paymentMethod,
          isQuick: false,
          note: note ?? null,
          customerId,
          items: { create: lines.map(lineData) },
        },
      })
      await applyStock(tx, ctx, sale.id, lines, "Venta (editada)")
      await linkPromotions(tx, sale.id, promo.applied)
      // La tarjeta de fidelidad se recalcula con el total y el cliente nuevos.
      await relinkLoyalty(tx, ctx, sale.id, customerId, total)
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Venta actualizada" }
}

// ─── Eliminar ───────────────────────────────────────────────────────────────

export async function deleteSale(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Venta no encontrada." }

  try {
    assertCan(ctx, "sales:delete")
    const sale = await db.sale.findFirst({
      where: { id: parsedId.data, businessId: ctx.businessId },
      include: { movements: true },
    })
    if (!sale) return { ok: false, message: "Venta no encontrada." }
    if (await db.sale.count({ where: { returnOfId: sale.id } })) {
      return { ok: false, message: "Esta venta tiene devoluciones. Elimina primero la devolución (aparece como una venta en negativo)." }
    }

    await db.$transaction(async (tx) => {
      // Si es una devolución, su solicitud se borra con ella (así se puede volver a devolver).
      if (sale.returnOfId) await tx.saleReturn.deleteMany({ where: { returnSaleId: sale.id } })
      // Los materiales de las recetas vuelven a como estaban, y se descuenta lo que sumó a la tarjeta de fidelidad.
      await revertMaterials(tx, sale.id)
      await revertLoyalty(tx, sale.id)
      // Devuelve al stock lo que se había descontado, dejando registro.
      for (const m of sale.movements) {
        await tx.product.update({ where: { id: m.productId }, data: { stock: { increment: -m.quantity } } })
        await tx.inventoryMovement.create({
          data: {
            businessId: ctx.businessId,
            productId: m.productId,
            type: "IN",
            quantity: -m.quantity,
            reason: "Venta eliminada",
            createdById: ctx.user.id,
          },
        })
      }
      await tx.sale.delete({ where: { id: sale.id } })
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Venta eliminada" }
}
