"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { dateKeyToInstant } from "@/lib/dates"
import { idSchema, quickSaleSchema, saleSchema, type QuickSaleInput, type SaleInput } from "@/lib/validations"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

function revalidate() {
  revalidatePath("/dashboard", "layout")
}

export async function createQuickSale(input: QuickSaleInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = quickSaleSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { amount, date, paymentMethod, note } = parsed.data

  try {
    assertCan(ctx, "sales:create")
    await db.sale.create({
      data: {
        businessId: ctx.businessId,
        date: dateKeyToInstant(date, ctx.timezone),
        total: amount,
        paymentMethod,
        isQuick: true,
        note,
        createdById: ctx.user.id,
        items: {
          create: { description: "Venta rápida", quantity: 1, unitPrice: amount, subtotal: amount },
        },
      },
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Venta guardada" }
}

export async function createSale(input: SaleInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = saleSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { items, date, paymentMethod, customerName, note } = parsed.data

  try {
    assertCan(ctx, "sales:create")

    // Solo productos de este negocio.
    const productIds = [...new Set(items.map((i) => i.productId).filter((id): id is string => Boolean(id)))]
    const products = productIds.length
      ? await db.product.findMany({ where: { businessId: ctx.businessId, id: { in: productIds } } })
      : []
    const byId = new Map(products.map((p) => [p.id, p]))
    if (products.length !== productIds.length) {
      return { ok: false, message: "Uno de los productos ya no existe. Recarga la página." }
    }

    const lines = items.map((item) => {
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
    const total = lines.reduce((sum, l) => sum + l.subtotal, 0)
    if (total > 2_000_000_000) return { ok: false, message: "El total de la venta es demasiado alto." }

    await db.$transaction(async (tx) => {
      let customerId: string | null = null
      if (customerName) {
        const existing = await tx.customer.findFirst({
          where: { businessId: ctx.businessId, name: { equals: customerName, mode: "insensitive" } },
        })
        customerId = existing
          ? existing.id
          : (await tx.customer.create({ data: { businessId: ctx.businessId, name: customerName } })).id
      }

      const sale = await tx.sale.create({
        data: {
          businessId: ctx.businessId,
          date: dateKeyToInstant(date, ctx.timezone),
          total,
          paymentMethod,
          note,
          customerId,
          createdById: ctx.user.id,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              unitCost: l.unitCost,
              subtotal: l.subtotal,
            })),
          },
        },
      })

      // Descuenta stock y deja registro del movimiento.
      for (const line of lines) {
        if (!line.productId || !line.trackStock) continue
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.quantity } },
        })
        await tx.inventoryMovement.create({
          data: {
            businessId: ctx.businessId,
            productId: line.productId,
            type: "OUT",
            quantity: -line.quantity,
            reason: "Venta",
            saleId: sale.id,
            createdById: ctx.user.id,
          },
        })
      }
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Venta guardada" }
}

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
      // Devuelve al stock lo que se había descontado.
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
