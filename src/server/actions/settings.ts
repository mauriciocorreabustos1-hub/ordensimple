"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { isFoodBusiness } from "@/lib/business-kind"
import { COUNTRIES } from "@/lib/constants"
import { isPurchaseCategory } from "@/lib/income-statement"
import {
  businessSettingsSchema,
  categoryNameSchema,
  idSchema,
  preferencesSchema,
  type BusinessSettingsInput,
  type PreferencesInput,
} from "@/lib/validations"
import { verifyPassword } from "better-auth/crypto"
import { cancelSubscriptionsOf } from "@/server/billing"
import { allowAttempt } from "@/server/rate-limit"
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

  const data = { ...parsed.data }
  // Las mesas son solo para negocios de comida; los nombres repetidos se guardan una vez.
  if ((data.tableCount !== undefined || data.tableExtras) && !isFoodBusiness(ctx.business.type)) {
    return { ok: false, message: "Las mesas son para restaurantes, cafés y negocios de comida." }
  }
  if (data.tableExtras) data.tableExtras = [...new Map(data.tableExtras.map((t) => [t.toLowerCase(), t])).values()]

  try {
    assertCan(ctx, "settings:manage")
    await db.businessSettings.upsert({
      where: { businessId: ctx.businessId },
      create: { businessId: ctx.businessId, ...data },
      update: data,
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
    await db.expenseCategory.create({
      // Si es compra de mercadería (ej. "Mercadería", "Insumos"), su costo va al costo de venta y no se cuenta dos veces.
      data: { businessId: ctx.businessId, name: parsed.data.name, isVariable: isPurchaseCategory(parsed.data.name) },
    })
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

/**
 * La persona elimina su propia cuenta: se borran la cuenta y los negocios de los que es dueña
 * (con todas sus ventas, gastos, productos y clientes). De negocios ajenos solo se quita su acceso.
 */
export async function deleteMyAccount(confirmEmail: string, password: string): Promise<ActionResult> {
  const user = await requireUser()
  if (typeof confirmEmail !== "string" || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, message: "El correo no coincide. No se eliminó nada." }
  }
  try {
    // Pide la contraseña: si alguien toma un celular con la sesión abierta, no puede borrar el negocio.
    if (!(await allowAttempt(`borrar-cuenta:${user.id}`, 5, 15 * 60_000))) {
      return { ok: false, message: "Intentaste varias veces. Espera unos minutos." }
    }
    const credential = await db.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { password: true } })
    if (!credential?.password || typeof password !== "string" || !(await verifyPassword({ hash: credential.password, password }))) {
      return { ok: false, message: "La contraseña no es correcta. No se eliminó nada." }
    }

    const owned = await db.businessMember.findMany({ where: { userId: user.id, role: "OWNER" }, select: { businessId: true } })
    const ownedIds = owned.map((m) => m.businessId)
    if (!(await cancelSubscriptionsOf(ownedIds))) {
      return { ok: false, message: "No pudimos cancelar tu suscripción en Mercado Pago. Cancélala en Tu plan e intenta de nuevo." }
    }
    await db.$transaction([db.business.deleteMany({ where: { id: { in: ownedIds } } }), db.user.delete({ where: { id: user.id } })])
    if (ownedIds.length) {
      await db.user.updateMany({ where: { activeBusinessId: { in: ownedIds } }, data: { activeBusinessId: null } })
    }
    console.info(`[cuenta] ${user.email} eliminó su cuenta y ${ownedIds.length} negocio(s)`)
    return { ok: true, message: "Tu cuenta fue eliminada" }
  } catch (error) {
    return toActionError(error)
  }
}

/** Guarda el método del segundo paso ("email" o "app") después de activarlo, o lo borra al desactivarlo. */
export async function setTwoFactorMethod(method: "email" | "app" | null): Promise<ActionResult> {
  const user = await requireUser()
  if (method !== null && method !== "email" && method !== "app") return { ok: false, message: "Método no válido." }
  const row = await db.user.findUnique({ where: { id: user.id }, select: { twoFactorEnabled: true } })
  if (method && !row?.twoFactorEnabled) return { ok: false, message: "Primero activa la verificación en dos pasos." }
  await db.user.update({ where: { id: user.id }, data: { twoFactorMethod: method } })
  revalidatePath("/dashboard/configuracion")
  return { ok: true }
}

/** Marca el tutorial de bienvenida como visto (no se vuelve a abrir solo; se puede ver desde el menú). */
export async function markWelcomeTourSeen(): Promise<ActionResult> {
  const user = await requireUser()
  await db.user.updateMany({ where: { id: user.id, welcomeTourAt: null }, data: { welcomeTourAt: new Date() } })
  return { ok: true }
}
