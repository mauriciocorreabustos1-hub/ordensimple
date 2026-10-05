"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { sendEmail, sendEmailBatch } from "@/lib/email"
import { directEmail, planGiftEmail, promoEmail } from "@/lib/email-templates"
import { unsubscribeUrl } from "@/lib/unsubscribe"
import { PLANS } from "@/lib/plans"
import { isAdminEmail, requireAdmin } from "@/server/admin"
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

// ─── Correo a personas específicas ──────────────────────────────────────────

/** Busca personas por nombre o correo para elegir a quién escribirle. */
export async function searchUsersForEmail(q: string) {
  await requireAdmin()
  const term = String(q ?? "").trim().slice(0, 80)
  if (term.length < 2) return []
  return db.user.findMany({
    where: { OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }] },
    select: { id: true, name: true, email: true, marketingOptIn: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  })
}

const directSchema = z.object({
  userIds: z.array(z.string().min(1)).max(50, "Máximo 50 personas por envío"),
  subject: z.string().trim().min(3, "Escribe el asunto").max(150),
  body: z.string().trim().min(10, "Escribe el mensaje").max(5000),
  buttonLabel: z.string().trim().max(40).optional(),
  buttonUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https?:\/\/\S+$/.test(v), "El enlace debe empezar con https://")
    .optional(),
  /** Si es promoción, solo llega a quien aceptó recibir ofertas y trae el enlace para darse de baja. */
  promo: z.boolean(),
})

export type DirectEmailInput = z.input<typeof directSchema>

function parseDirect(input: DirectEmailInput) {
  const parsed = directSchema.safeParse(input)
  if (!parsed.success) return { error: validationError(parsed.error) }
  const d = parsed.data
  if (Boolean(d.buttonLabel) !== Boolean(d.buttonUrl)) {
    return { error: { ok: false as const, message: "Para el botón, escribe el texto y el enlace (o deja ambos vacíos)." } }
  }
  return { data: d }
}

function buildDirect(d: z.output<typeof directSchema>, user: { id: string; name: string; email: string }) {
  if (d.promo) return buildPromo({ ...d, couponCode: undefined, audience: "ALL" }, user)
  return { to: user.email, ...directEmail({ ...d, name: user.name }) }
}

/** Envía el correo solo al administrador, para revisarlo antes. */
export async function sendTestDirectEmail(input: DirectEmailInput): Promise<ActionResult> {
  const admin = await requireAdmin()
  const r = parseDirect(input)
  if (r.error) return r.error
  try {
    const email = buildDirect(r.data, { id: admin.id, name: admin.name, email: admin.email })
    await sendEmail({ ...email, subject: `[Prueba] ${email.subject}` })
    return { ok: true, message: `Te enviamos una prueba a ${admin.email}` }
  } catch (error) {
    return toActionError(error)
  }
}

/** Envía un correo a las personas elegidas (máximo 50) y lo deja en el historial. */
export async function sendDirectEmail(input: DirectEmailInput): Promise<ActionResult> {
  const admin = await requireAdmin()
  const r = parseDirect(input)
  if (r.error) return r.error
  const d = r.data
  if (d.userIds.length === 0) return { ok: false, message: "Elige al menos una persona." }

  try {
    const found = await db.user.findMany({
      where: { id: { in: d.userIds } },
      select: { id: true, name: true, email: true, marketingOptIn: true },
    })
    // Una promoción no le llega a quien no quiere recibir ofertas.
    const users = d.promo ? found.filter((u) => u.marketingOptIn) : found
    const skipped = found.length - users.length
    if (users.length === 0) {
      return {
        ok: false,
        message: d.promo
          ? "Ninguna de esas personas aceptó recibir ofertas. Si es un aviso o una respuesta, desmarca “Es una promoción”."
          : "No encontramos a esas personas.",
      }
    }

    const campaign = await db.emailCampaign.create({
      data: {
        subject: d.subject,
        body: d.body,
        buttonLabel: d.buttonLabel || null,
        buttonUrl: d.buttonUrl || null,
        audience: "DIRECT",
        recipients: users.length,
        toEmails: users.map((u) => u.email).join(", "),
        createdBy: admin.email,
      },
    })
    const { sent, failed } = await sendEmailBatch(users.map((u) => buildDirect(d, u)))
    await db.emailCampaign.update({
      where: { id: campaign.id },
      data: { sentCount: sent, failedCount: failed, sentAt: new Date() },
    })

    revalidatePath("/admin")
    if (sent === 0) return { ok: false, message: "No se pudo enviar el correo. Revisa la configuración de Resend." }
    const parts = [`¡Listo! Se envi${sent === 1 ? "ó 1 correo" : `aron ${sent} correos`}`]
    if (failed) parts.push(`${failed} fallaron`)
    if (skipped) parts.push(`${skipped} no aceptan ofertas y se omitieron`)
    return { ok: true, message: parts.join(" · ") }
  } catch (error) {
    return toActionError(error)
  }
}

// ─── Eliminar cuentas ───────────────────────────────────────────────────────

const deleteUserSchema = z.object({
  userId: z.string().min(1),
  /** Se escribe el correo para confirmar: evita borrar a la persona equivocada. */
  confirmEmail: z.string().trim().toLowerCase(),
})

/**
 * Elimina una cuenta para siempre: el usuario y los negocios donde es dueño (con todas sus ventas,
 * gastos, productos y clientes). De los negocios de otros solo se quita su acceso.
 */
export async function deleteUserAccount(input: z.input<typeof deleteUserSchema>): Promise<ActionResult> {
  const admin = await requireAdmin()
  const parsed = deleteUserSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Datos inválidos." }
  const { userId, confirmEmail } = parsed.data

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, memberships: { where: { role: "OWNER" }, select: { businessId: true } } },
    })
    if (!user) return { ok: false, message: "Esa cuenta ya no existe." }
    if (user.email.toLowerCase() !== confirmEmail) return { ok: false, message: "El correo no coincide. No se eliminó nada." }
    if (user.email.toLowerCase() === admin.email.toLowerCase()) return { ok: false, message: "No puedes eliminar tu propia cuenta desde aquí." }
    if (isAdminEmail(user.email)) return { ok: false, message: "No se puede eliminar la cuenta de un administrador." }

    const ownedIds = user.memberships.map((m) => m.businessId)
    await db.$transaction([
      // Borra en cascada ventas, gastos, productos, clientes, invitaciones, etc. de sus negocios.
      db.business.deleteMany({ where: { id: { in: ownedIds } } }),
      // Borra en cascada sesiones, accesos a otros negocios y notificaciones.
      db.user.delete({ where: { id: userId } }),
    ])
    // Quien tenía abierto un negocio borrado entrará al siguiente que tenga.
    if (ownedIds.length) await db.user.updateMany({ where: { activeBusinessId: { in: ownedIds } }, data: { activeBusinessId: null } })

    console.info(`[admin] ${admin.email} eliminó la cuenta ${user.email} y ${ownedIds.length} negocio(s)`)
    revalidatePath("/admin")
    return { ok: true, message: `Se eliminó la cuenta ${user.email}` }
  } catch (error) {
    return toActionError(error)
  }
}
