"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { dateKeyToInstant, toDateKey } from "@/lib/dates"
import {
  idSchema,
  quickSaleSchema,
  saleSchema,
  type QuickSaleInput,
  type SaleInput,
} from "@/lib/validations"
import { applyStock, buildLines, FIADO_PRO, fiadoBlocked, lineData, MAX_TOTAL, resolveCustomer, revertStock } from "@/server/sale-core"
import { assertCan, requireBusiness, type BusinessContext } from "@/server/session"
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

export async function createQuickSale(input: QuickSaleInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = quickSaleSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { amount, date, paymentMethod, customerName, note, clientId, soldAt } = parsed.data

  try {
    assertCan(ctx, "sales:create")
    if (fiadoBlocked(ctx, paymentMethod)) return { ok: false, message: FIADO_PRO }
    if (await alreadySynced(ctx, clientId)) return { ok: true, message: "Venta guardada" }
    await db.$transaction(async (tx) => {
      const customerId = await resolveCustomer(tx, ctx.businessId, customerName)
      await tx.sale.create({
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
      })
    })
  } catch (error) {
    if (isDuplicate(error)) return { ok: true, message: "Venta guardada" }
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: paymentMethod === "FIADO" ? "Venta fiada guardada" : "Venta guardada" }
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

export async function createSale(input: SaleInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = saleSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { items, date, paymentMethod, customerName, note, clientId, soldAt } = parsed.data

  try {
    assertCan(ctx, "sales:create")
    if (fiadoBlocked(ctx, paymentMethod)) return { ok: false, message: FIADO_PRO }
    if (await alreadySynced(ctx, clientId)) return { ok: true, message: "Venta guardada" }
    const lines = await buildLines(ctx, items)
    if (!lines) return { ok: false, message: "Uno de los productos ya no existe. Recarga la página." }
    const total = lines.reduce((sum, l) => sum + l.subtotal, 0)
    if (total > MAX_TOTAL) return { ok: false, message: "El total de la venta es demasiado alto." }

    await db.$transaction(async (tx) => {
      const customerId = await resolveCustomer(tx, ctx.businessId, customerName)
      const sale = await tx.sale.create({
        data: {
          businessId: ctx.businessId,
          clientId,
          date: saleDate(date, ctx, soldAt),
          total,
          paymentMethod,
          note,
          customerId,
          createdById: ctx.user.id,
          items: { create: lines.map(lineData) },
        },
      })
      await applyStock(tx, ctx, sale.id, lines, "Venta")
    })
  } catch (error) {
    if (isDuplicate(error)) return { ok: true, message: "Venta guardada" }
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: paymentMethod === "FIADO" ? "Venta fiada guardada" : "Venta guardada" }
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
    const lines = await buildLines(ctx, items)
    if (!lines) return { ok: false, message: "Uno de los productos ya no existe. Recarga la página." }
    const total = lines.reduce((sum, l) => sum + l.subtotal, 0)
    if (total > MAX_TOTAL) return { ok: false, message: "El total de la venta es demasiado alto." }

    await db.$transaction(async (tx) => {
      // Se deshace el stock de la versión anterior y se aplica el de la nueva.
      await revertStock(tx, sale.id)
      await tx.saleItem.deleteMany({ where: { saleId: sale.id } })
      const customerId = await resolveCustomer(tx, ctx.businessId, customerName)
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          date: resolveDate(date, ctx, sale.date),
          total,
          paymentMethod,
          isQuick: false,
          note: note ?? null,
          customerId,
          items: { create: lines.map(lineData) },
        },
      })
      await applyStock(tx, ctx, sale.id, lines, "Venta (editada)")
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

    await db.$transaction(async (tx) => {
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
