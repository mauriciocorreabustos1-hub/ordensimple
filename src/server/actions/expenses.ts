"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { dateKeyToInstant } from "@/lib/dates"
import { expenseSchema, idSchema, type ExpenseInput } from "@/lib/validations"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

export async function createExpense(input: ExpenseInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { description, categoryId, amount, date, supplierName } = parsed.data

  try {
    assertCan(ctx, "expenses:create")

    if (categoryId) {
      const category = await db.expenseCategory.findFirst({ where: { id: categoryId, businessId: ctx.businessId } })
      if (!category) return { ok: false, message: "Esa categoría ya no existe. Recarga la página." }
    }

    await db.$transaction(async (tx) => {
      let supplierId: string | null = null
      if (supplierName) {
        const existing = await tx.supplier.findFirst({
          where: { businessId: ctx.businessId, name: { equals: supplierName, mode: "insensitive" } },
        })
        supplierId = existing
          ? existing.id
          : (await tx.supplier.create({ data: { businessId: ctx.businessId, name: supplierName } })).id
      }

      await tx.expense.create({
        data: {
          businessId: ctx.businessId,
          description,
          amount,
          date: dateKeyToInstant(date, ctx.timezone),
          categoryId: categoryId ?? null,
          supplierId,
          createdById: ctx.user.id,
        },
      })
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Gasto guardado" }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Gasto no encontrado." }

  try {
    assertCan(ctx, "expenses:delete")
    const { count } = await db.expense.deleteMany({ where: { id: parsedId.data, businessId: ctx.businessId } })
    if (count === 0) return { ok: false, message: "Gasto no encontrado." }
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Gasto eliminado" }
}
