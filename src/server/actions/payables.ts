"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { zonedTimeToUtc } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { idSchema, payableSchema, type PayableInput } from "@/lib/validations"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

/** Anota un pago pendiente a un proveedor (factura por pagar) con su fecha de vencimiento. */
export async function createPayable(input: PayableInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = payableSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { description, supplierName, amount, dueDate } = parsed.data

  try {
    assertCan(ctx, "suppliers:manage")
    if (!canUseFeature(ctx.business.plan, "suppliers")) return { ok: false, message: "Los pagos a proveedores son parte del plan Pro." }
    let supplierId: string | null = null
    if (supplierName) {
      const existing = await db.supplier.findFirst({
        where: { businessId: ctx.businessId, name: { equals: supplierName, mode: "insensitive" } },
        select: { id: true },
      })
      supplierId = existing ? existing.id : (await db.supplier.create({ data: { businessId: ctx.businessId, name: supplierName } })).id
    }
    const [y, m, d] = dueDate.split("-").map(Number)
    await db.payable.create({
      data: {
        businessId: ctx.businessId,
        supplierId,
        description,
        amount,
        // A mediodía del día de vencimiento, en la zona del negocio.
        dueDate: zonedTimeToUtc(y, m, d, ctx.timezone, 12),
        createdById: ctx.user.id,
      },
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Pago pendiente guardado. Te avisaremos antes de que venza." }
}

/** Marca como pagado: también queda registrado como gasto (en la categoría de compras a proveedores). */
export async function markPayablePaid(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Pago no encontrado." }

  try {
    assertCan(ctx, "suppliers:manage")
    const payable = await db.payable.findFirst({ where: { id: parsedId.data, businessId: ctx.businessId, paidAt: null } })
    if (!payable) return { ok: false, message: "Ese pago ya no está pendiente." }
    const category = await db.expenseCategory.findFirst({
      where: { businessId: ctx.businessId, isVariable: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    })
    await db.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          businessId: ctx.businessId,
          description: payable.description,
          amount: payable.amount,
          date: new Date(),
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
  return { ok: true, message: "Pagado. Quedó registrado como gasto de hoy." }
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
