"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { dateKeyToInstant, toDateKey, zonedParts } from "@/lib/dates"
import { isHonorarium } from "@/lib/income-statement"
import { honorariumRetentionRate } from "@/lib/vat"
import { expenseSchema, idSchema, type ExpenseInput } from "@/lib/validations"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

export async function createExpense(input: ExpenseInput): Promise<ActionResult> {
  return saveExpense(null, input)
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Gasto no encontrado." }
  return saveExpense(parsedId.data, input)
}

async function saveExpense(id: string | null, input: ExpenseInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { description, categoryId, amount, date, supplierName, hasInvoice, specificTax = 0, withholds } = parsed.data

  let createdSupplier: string | null = null
  try {
    assertCan(ctx, id ? "expenses:edit" : "expenses:create")
    const current = id ? await db.expense.findFirst({ where: { id, businessId: ctx.businessId } }) : null
    if (id && !current) return { ok: false, message: "Gasto no encontrado." }

    const category = categoryId ? await db.expenseCategory.findFirst({ where: { id: categoryId, businessId: ctx.businessId } }) : null
    if (categoryId && !category) return { ok: false, message: "Esa categoría ya no existe. Recarga la página." }
    if (specificTax > amount) return { ok: false, message: "Los impuestos específicos no pueden ser más que el total de la factura." }

    await db.$transaction(async (tx) => {
      let supplierId: string | null = null
      if (supplierName) {
        const existing = await tx.supplier.findFirst({
          where: { businessId: ctx.businessId, name: { equals: supplierName, mode: "insensitive" } },
        })
        if (existing) supplierId = existing.id
        else {
          supplierId = (await tx.supplier.create({ data: { businessId: ctx.businessId, name: supplierName } })).id
          createdSupplier = supplierName
        }
      }

      const when = current && toDateKey(current.date, ctx.timezone) === date ? current.date : dateKeyToInstant(date, ctx.timezone)
      // Impuestos específicos: solo en facturas. Si el negocio no cobra IVA (no se envía la factura), se conserva lo que tenía.
      const invoiced = hasInvoice ?? current?.hasInvoice ?? false
      const specific = !invoiced ? 0 : hasInvoice === undefined ? (current?.specificTax ?? 0) : specificTax
      // Boleta de honorarios: la retención se calcula con la tasa del año del gasto.
      const withholding = isHonorarium(category?.name) && withholds ? Math.round(amount * honorariumRetentionRate(zonedParts(when, ctx.timezone).year)) : 0
      const data = {
        description,
        amount,
        // Al editar sin cambiar el día se conserva la hora original.
        date: when,
        specificTax: specific,
        withholding,
        categoryId: categoryId ?? null,
        supplierId,
        // Solo se envía si el negocio cobra IVA; si no, al editar se conserva lo que tenía.
        ...(hasInvoice === undefined ? {} : { hasInvoice }),
      }
      if (current) await tx.expense.update({ where: { id: current.id }, data })
      else await tx.expense.create({ data: { ...data, businessId: ctx.businessId, createdById: ctx.user.id } })
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  const saved = id ? "Gasto actualizado" : "Gasto guardado"
  // Si el proveedor es nuevo, se avisa que quedó su ficha en Proveedores.
  return { ok: true, message: createdSupplier ? `${saved}. Creamos la ficha de ${createdSupplier} en Proveedores.` : saved }
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
