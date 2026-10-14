"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { formatDate, zonedTimeToUtc } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { idSchema, payableSchema, type PayableInput } from "@/lib/validations"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

/** Anota un pago pendiente a un proveedor (factura por pagar) con su fecha de vencimiento. */
export async function createPayable(input: PayableInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = payableSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { description, supplierName, amount, dueDate, hasInvoice = true, invoiceDate } = parsed.data
  let createdSupplier: string | null = null

  try {
    assertCan(ctx, "suppliers:manage")
    if (!canUseFeature(ctx.business.plan, "suppliers")) return { ok: false, message: "Los pagos a proveedores son parte del plan Pro." }
    let supplierId: string | null = null
    if (supplierName) {
      const existing = await db.supplier.findFirst({
        where: { businessId: ctx.businessId, name: { equals: supplierName, mode: "insensitive" } },
        select: { id: true },
      })
      if (existing) supplierId = existing.id
      else {
        supplierId = (await db.supplier.create({ data: { businessId: ctx.businessId, name: supplierName } })).id
        createdSupplier = supplierName
      }
    }
    const [y, m, d] = dueDate.split("-").map(Number)
    const [iy, im, id] = invoiceDate ? invoiceDate.split("-").map(Number) : []
    await db.payable.create({
      data: {
        businessId: ctx.businessId,
        supplierId,
        description,
        amount,
        // A mediodía del día de vencimiento, en la zona del negocio.
        dueDate: zonedTimeToUtc(y, m, d, ctx.timezone, 12),
        hasInvoice,
        invoiceDate: hasInvoice ? (invoiceDate ? zonedTimeToUtc(iy, im, id, ctx.timezone, 12) : new Date()) : null,
        createdById: ctx.user.id,
      },
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return {
    ok: true,
    message: createdSupplier
      ? `Pago pendiente guardado. Creamos la ficha de ${createdSupplier} en Proveedores.`
      : "Pago pendiente guardado. Te avisaremos antes de que venza.",
  }
}

/** Marca como pagado: también queda registrado como gasto (en la categoría de compras a proveedores). */
export async function markPayablePaid(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Pago no encontrado." }

  let expenseDate: Date | null = null
  try {
    assertCan(ctx, "suppliers:manage")
    const payable = await db.payable.findFirst({ where: { id: parsedId.data, businessId: ctx.businessId, paidAt: null } })
    if (!payable) return { ok: false, message: "Ese pago ya no está pendiente." }
    const category = await db.expenseCategory.findFirst({
      where: { businessId: ctx.businessId, isVariable: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    })
    // Una factura va en el mes de la factura (ahí se descuenta su IVA en el F29), no en el del pago.
    expenseDate = payable.hasInvoice ? (payable.invoiceDate ?? payable.createdAt) : new Date()
    await db.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          businessId: ctx.businessId,
          description: payable.description,
          amount: payable.amount,
          date: expenseDate!,
          hasInvoice: payable.hasInvoice,
          categoryId: category?.id ?? null,
          supplierId: payable.supplierId,
          createdById: ctx.user.id,
        },
      })
      await tx.payable.update({ where: { id: payable.id }, data: { paidAt: new Date(), expenseId: expense.id } })
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  const sameDay = expenseDate && formatDate(expenseDate, ctx.timezone) === formatDate(new Date(), ctx.timezone)
  return {
    ok: true,
    message: sameDay
      ? "Pagado. Quedó registrado como gasto de hoy."
      : `Pagado. Quedó como gasto del ${formatDate(expenseDate!, ctx.timezone, { day: "numeric", month: "long" })}, la fecha de la factura.`,
  }
}

export async function deletePayable(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Pago no encontrado." }
  try {
    assertCan(ctx, "suppliers:manage")
    const { count } = await db.payable.deleteMany({ where: { id: parsedId.data, businessId: ctx.businessId, paidAt: null } })
    if (count === 0) return { ok: false, message: "Pago no encontrado." }
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Pago pendiente eliminado" }
}
