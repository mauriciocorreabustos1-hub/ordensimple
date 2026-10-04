"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { dateKeyToInstant, toDateKey } from "@/lib/dates"
import {
  idSchema,
  quickSaleSchema,
  saleSchema,
  type QuickSaleInput,
  type SaleInput,
} from "@/lib/validations"
import { assertCan, requireBusiness, type BusinessContext } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

type Tx = Prisma.TransactionClient

function revalidate() {
  revalidatePath("/dashboard", "layout")
}

const MAX_TOTAL = 2_000_000_000

/** Busca el cliente por nombre (sin distinguir mayúsculas) o lo crea. */
async function resolveCustomer(tx: Tx, businessId: string, name: string | undefined) {
  if (!name) return null
  const existing = await tx.customer.findFirst({
    where: { businessId, name: { equals: name, mode: "insensitive" } },
  })
  return existing ? existing.id : (await tx.customer.create({ data: { businessId, name } })).id
}

/** Si la fecha no cambió al editar, se conserva la hora original de la venta. */
function resolveDate(key: string, ctx: BusinessContext, previous?: Date) {
  if (previous && toDateKey(previous, ctx.timezone) === key) return previous
  return dateKeyToInstant(key, ctx.timezone)
}

type Line = {
  productId: string | null
  description: string
  quantity: number
  unitPrice: number
  unitCost: number
  subtotal: number
  trackStock: boolean
}

/** Valida que los productos sean de este negocio y arma las líneas con su costo. */
async function buildLines(ctx: BusinessContext, items: SaleInput["items"]): Promise<Line[] | null> {
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
    }
  })
}

/** Descuenta stock de las líneas con control de stock y registra el movimiento. */
async function applyStock(tx: Tx, ctx: BusinessContext, saleId: string, lines: Line[], reason: string) {
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
async function revertStock(tx: Tx, saleId: string) {
  const movements = await tx.inventoryMovement.findMany({ where: { saleId } })
  for (const m of movements) {
    await tx.product.update({ where: { id: m.productId }, data: { stock: { increment: -m.quantity } } })
  }
  await tx.inventoryMovement.deleteMany({ where: { saleId } })
}

const lineData = (l: Line) => ({
  productId: l.productId,
  description: l.description,
  quantity: l.quantity,
  unitPrice: l.unitPrice,
  unitCost: l.unitCost,
  subtotal: l.subtotal,
})

// ─── Venta rápida ───────────────────────────────────────────────────────────

export async function createQuickSale(input: QuickSaleInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = quickSaleSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { amount, date, paymentMethod, customerName, note } = parsed.data

  try {
    assertCan(ctx, "sales:create")
    await db.$transaction(async (tx) => {
      const customerId = await resolveCustomer(tx, ctx.businessId, customerName)
      await tx.sale.create({
        data: {
          businessId: ctx.businessId,
          date: resolveDate(date, ctx),
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
  const { items, date, paymentMethod, customerName, note } = parsed.data

  try {
    assertCan(ctx, "sales:create")
    const lines = await buildLines(ctx, items)
    if (!lines) return { ok: false, message: "Uno de los productos ya no existe. Recarga la página." }
    const total = lines.reduce((sum, l) => sum + l.subtotal, 0)
    if (total > MAX_TOTAL) return { ok: false, message: "El total de la venta es demasiado alto." }

    await db.$transaction(async (tx) => {
      const customerId = await resolveCustomer(tx, ctx.businessId, customerName)
      const sale = await tx.sale.create({
        data: {
          businessId: ctx.businessId,
          date: resolveDate(date, ctx),
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
