"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { sendEmail, sendEmailBatch } from "@/lib/email"
import { planGiftEmail, promoEmail } from "@/lib/email-templates"
import { unsubscribeUrl } from "@/lib/unsubscribe"
import { PLANS } from "@/lib/plans"
import { requireAdmin } from "@/server/admin"
import { audienceWhere } from "@/server/queries/campaigns"
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

// ─── Correos de promoción ───────────────────────────────────────────────────

const campaignSchema = z.object({
  subject: z.string().trim().min(3, "Escribe el asunto").max(150),
  body: z.string().trim().min(10, "Escribe el mensaje").max(5000),
  buttonLabel: z.string().trim().max(40).optional(),
  buttonUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https?:\/\/\S+$/.test(v), "El enlace debe empezar con https://")
    .optional(),
  couponCode: z.string().trim().toUpperCase().max(30).optional(),
  audience: z.enum(["ALL", "FREE", "PAID"]),
})

export type CampaignInput = z.input<typeof campaignSchema>

async function parseCampaign(input: CampaignInput) {
  const parsed = campaignSchema.safeParse(input)
  if (!parsed.success) return { error: validationError(parsed.error) }
  const d = parsed.data
  if (Boolean(d.buttonLabel) !== Boolean(d.buttonUrl)) {
    return { error: { ok: false as const, message: "Para el botón, escribe el texto y el enlace (o deja ambos vacíos)." } }
  }
  if (d.couponCode) {
    const coupon = await db.coupon.findUnique({ where: { code: d.couponCode }, select: { active: true } })
    if (!coupon || !coupon.active) {
      return { error: { ok: false as const, message: `El código ${d.couponCode} no existe o está pausado.` } }
    }
  }
  return { data: d }
}

function buildPromo(d: z.output<typeof campaignSchema>, user: { id: string; name: string; email: string }) {
  const unsub = unsubscribeUrl(user.id)
  const email = promoEmail({ ...d, name: user.name, unsubscribeUrl: unsub })
  return {
    to: user.email,
    ...email,
    headers: {
      "List-Unsubscribe": `<${unsub.replace("/baja?", "/api/baja?")}>, <mailto:contacto@ordensimple.cl?subject=baja>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  }
}

/** Envía el correo solo al administrador, para revisarlo antes del envío masivo. */
export async function sendTestCampaign(input: CampaignInput): Promise<ActionResult> {
  const admin = await requireAdmin()
  const r = await parseCampaign(input)
  if (r.error) return r.error
  try {
    const email = buildPromo(r.data, { id: admin.id, name: admin.name, email: admin.email })
    await sendEmail({ ...email, subject: `[Prueba] ${email.subject}` })
    return { ok: true, message: `Te enviamos una prueba a ${admin.email}` }
  } catch (error) {
    return toActionError(error)
  }
}

/** Envío masivo: solo a quienes aceptaron recibir ofertas, con enlace para darse de baja. */
export async function sendCampaign(input: CampaignInput): Promise<ActionResult> {
  const admin = await requireAdmin()
  const r = await parseCampaign(input)
  if (r.error) return r.error
  const d = r.data

  try {
    const users = await db.user.findMany({
      where: audienceWhere(d.audience),
      select: { id: true, name: true, email: true },
    })
    if (users.length === 0) return { ok: false, message: "No hay personas que hayan aceptado recibir ofertas en ese grupo." }

    const campaign = await db.emailCampaign.create({
      data: {
        subject: d.subject,
        body: d.body,
        buttonLabel: d.buttonLabel || null,
        buttonUrl: d.buttonUrl || null,
        couponCode: d.couponCode || null,
        audience: d.audience,
        recipients: users.length,
        createdBy: admin.email,
      },
    })

    const { sent, failed } = await sendEmailBatch(users.map((u) => buildPromo(d, u)))
    await db.emailCampaign.update({
      where: { id: campaign.id },
      data: { sentCount: sent, failedCount: failed, sentAt: new Date() },
    })

    revalidatePath("/admin")
    if (sent === 0) return { ok: false, message: "No se pudo enviar ningún correo. Revisa la configuración de Resend." }
    return {
      ok: true,
      message: failed
        ? `Se enviaron ${sent} correos; ${failed} fallaron`
        : `¡Listo! Se enviaron ${sent} correo${sent === 1 ? "" : "s"}`,
    }
  } catch (error) {
    return toActionError(error)
  }
}
