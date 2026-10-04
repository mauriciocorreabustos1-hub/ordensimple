"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { COUNTRIES } from "@/lib/constants"
import {
  businessSettingsSchema,
  categoryNameSchema,
  idSchema,
  preferencesSchema,
  type BusinessSettingsInput,
  type PreferencesInput,
} from "@/lib/validations"
import { assertCan, requireBusiness, requireUser } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

export async function updateBusiness(input: BusinessSettingsInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = businessSettingsSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const data = parsed.data

  try {
    assertCan(ctx, "settings:manage")

    // Los montos se guardan en la unidad mínima de la moneda: cambiarla con datos existentes los distorsionaría.
    if (data.currency !== ctx.business.currency) {
      const [sales, expenses, products] = await Promise.all([
        db.sale.count({ where: { businessId: ctx.businessId } }),
        db.expense.count({ where: { businessId: ctx.businessId } }),
        db.product.count({ where: { businessId: ctx.businessId } }),
      ])
      if (sales + expenses + products > 0) {
        return {
          ok: false,
          message: "No puedes cambiar la moneda porque ya tienes ventas, gastos o productos registrados.",
        }
      }
    }

    const timezone =
      data.country !== ctx.business.country
        ? (COUNTRIES.find((c) => c.code === data.country)?.timezone ?? ctx.business.timezone)
        : ctx.business.timezone

    await db.business.update({
      where: { id: ctx.businessId },
      data: { name: data.name, type: data.type ?? null, country: data.country, currency: data.currency, timezone },
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Datos del negocio guardados" }
}

export async function updatePreferences(input: PreferencesInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = preferencesSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)

  try {
    assertCan(ctx, "settings:manage")
    await db.businessSettings.upsert({
      where: { businessId: ctx.businessId },
      create: { businessId: ctx.businessId, ...parsed.data },
      update: parsed.data,
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Preferencias guardadas" }
}

export async function createExpenseCategory(name: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = categoryNameSchema.safeParse({ name })
  if (!parsed.success) return validationError(parsed.error)

  try {
    assertCan(ctx, "settings:manage")
    await db.expenseCategory.create({ data: { businessId: ctx.businessId, name: parsed.data.name } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "Ya existe una categoría con ese nombre." }
    }
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Categoría creada" }
}

export async function deleteExpenseCategory(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Categoría no encontrada." }

  try {
    assertCan(ctx, "settings:manage")
    // Los gastos de esta categoría quedan "Sin categoría" (onDelete: SetNull).
    const { count } = await db.expenseCategory.deleteMany({ where: { id: parsedId.data, businessId: ctx.businessId } })
    if (count === 0) return { ok: false, message: "Categoría no encontrada." }
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Categoría eliminada" }
}

/** Cada persona decide si quiere recibir novedades y ofertas por correo. */
export async function updateMarketingOptIn(value: boolean): Promise<ActionResult> {
  const user = await requireUser()
  try {
    await db.user.update({ where: { id: user.id }, data: { marketingOptIn: Boolean(value) } })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard/configuracion")
  return { ok: true, message: value ? "Recibirás novedades y ofertas" : "Ya no recibirás ofertas por correo" }
}
