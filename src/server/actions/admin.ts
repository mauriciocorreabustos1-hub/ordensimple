"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { planGiftEmail } from "@/lib/email-templates"
import { PLANS } from "@/lib/plans"
import { requireAdmin } from "@/server/admin"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

/** Borra el registro de errores (después de revisarlos). Solo administradores. */
export async function clearErrorLog(): Promise<ActionResult> {
  await requireAdmin()
  const { count } = await db.errorLog.deleteMany({})
  revalidatePath("/admin")
  return { ok: true, message: count ? `Se limpiaron ${count} errores` : "No había errores" }
}

// ─── Suscripciones ──────────────────────────────────────────────────────────

const planSchema = z.enum(["FREE", "PRO", "BUSINESS"])

const setPlanSchema = z.object({
  businessId: z.string().min(1),
  plan: planSchema,
  /** Días de duración; null = sin vencimiento. Se ignora para el plan Gratis. */
  days: z.number().int().min(1).max(3650).nullable(),
  notify: z.boolean().default(false),
})

/** Cambia el plan de un negocio (regalar Pro, extender, quitar). */
export async function setBusinessPlan(input: z.input<typeof setPlanSchema>): Promise<ActionResult> {
  await requireAdmin()
  const parsed = setPlanSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { businessId, plan, days, notify } = parsed.data

  try {
    const planExpiresAt = plan === "FREE" || days === null ? null : new Date(Date.now() + days * 86_400_000)
    const business = await db.business.update({
      where: { id: businessId },
      data: { plan, planExpiresAt },
      select: {
        name: true,
        members: { where: { role: "OWNER" }, select: { user: { select: { name: true, email: true } } }, take: 1 },
      },
    })

    const owner = business.members[0]?.user
    if (notify && owner && plan !== "FREE") {
      const email = planGiftEmail({ name: owner.name, planName: PLANS[plan].name, businessName: business.name, expiresAt: planExpiresAt })
      await sendEmail({ to: owner.email, ...email }).catch((e) => console.error("[admin] correo de plan", e))
    }

    revalidatePath("/admin")
    return {
      ok: true,
      message:
        plan === "FREE"
          ? `${business.name} quedó en el plan Gratis`
          : `${business.name} ahora tiene ${PLANS[plan].name}${days ? ` por ${days} días` : " sin vencimiento"}`,
    }
  } catch (error) {
    return toActionError(error)
  }
}

// ─── Códigos de descuento ───────────────────────────────────────────────────

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,30}$/, "Usa de 3 a 30 letras, números o guiones (sin espacios ni tildes)"),
    kind: z.enum(["FREE_DAYS", "PERCENT"]),
    plan: z.enum(["PRO", "BUSINESS"]),
    days: z.number().int().min(1, "Mínimo 1 día").max(3650).nullable(),
    percentOff: z.number().int().min(1, "Mínimo 1%").max(100, "Máximo 100%").nullable(),
    maxRedemptions: z.number().int().min(1, "Mínimo 1 uso").max(1_000_000).nullable(),
    expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    note: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.kind !== "FREE_DAYS" || d.days, { path: ["days"], message: "¿Cuántos días regala?" })
  .refine((d) => d.kind !== "PERCENT" || d.percentOff, { path: ["percentOff"], message: "¿Qué porcentaje de descuento?" })

export type CouponInput = z.input<typeof couponSchema>

export async function createCoupon(input: CouponInput): Promise<ActionResult> {
  const admin = await requireAdmin()
  const parsed = couponSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const d = parsed.data

  try {
    await db.coupon.create({
      data: {
        code: d.code,
        kind: d.kind,
        plan: d.plan,
        days: d.kind === "FREE_DAYS" ? d.days : null,
        percentOff: d.kind === "PERCENT" ? d.percentOff : null,
        maxRedemptions: d.maxRedemptions,
        // Vence al terminar el día indicado (hora de Chile).
        expiresAt: d.expiresAt ? new Date(`${d.expiresAt}T23:59:59-03:00`) : null,
        note: d.note || null,
        createdBy: admin.email,
      },
    })
    revalidatePath("/admin")
    return { ok: true, message: `Código ${d.code} creado` }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "Ya existe un código con ese nombre.", fieldErrors: { code: ["Ya existe"] } }
    }
    return toActionError(error)
  }
}

export async function toggleCoupon(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin()
  try {
    await db.coupon.update({ where: { id }, data: { active } })
    revalidatePath("/admin")
    return { ok: true, message: active ? "Código activado" : "Código pausado" }
  } catch (error) {
    return toActionError(error)
  }
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    // Borrar el código no quita lo que ya ganaron quienes lo usaron.
    await db.coupon.delete({ where: { id } })
    revalidatePath("/admin")
    return { ok: true, message: "Código eliminado" }
  } catch (error) {
    return toActionError(error)
  }
}
