"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAppUrl } from "@/lib/app-url"
import { formatDate } from "@/lib/dates"
import { sendEmail, sendEmailBatch } from "@/lib/email"
import { directEmail, promoEmail } from "@/lib/email-templates"
import { checkoutPath, PLANS } from "@/lib/plans"
import { unsubscribeUrl } from "@/lib/unsubscribe"
import { requireAdmin } from "@/server/admin"
import { EXPIRED_COOLDOWN_DAYS, EXPIRED_KINDS, listExpiredPlans, type ExpiredPlanRow } from "@/server/queries/expired-plans"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

// Correos a los negocios cuyo plan venció: un recordatorio (aviso de su cuenta) o una oferta con un código de descuento
// (promoción: solo a quien aceptó recibir ofertas). Nunca más de uno por persona cada 7 días.

const schema = z.object({
  businessIds: z.array(z.string().min(1)).min(1, "Elige al menos un negocio").max(50, "Máximo 50 negocios por envío"),
  kind: z.enum(["aviso", "oferta"]),
  subject: z.string().trim().min(3, "Escribe el asunto").max(150),
  body: z.string().trim().min(10, "Escribe el mensaje").max(5000),
  buttonLabel: z.string().trim().min(2, "Escribe el texto del botón").max(40),
  couponCode: z.string().trim().toUpperCase().max(30).optional(),
})

export type ExpiredEmailInput = z.input<typeof schema>

const TZ = "America/Santiago"

/** Arma el correo de un negocio: reemplaza {negocio}, {plan}, {fecha} y {codigo} ({nombre} lo pone la plantilla). */
function build(d: z.output<typeof schema>, b: ExpiredPlanRow, to: { id: string; name: string; email: string }) {
  const app = getAppUrl()
  const fill = (s: string) =>
    s
      .replaceAll("{negocio}", b.name)
      .replaceAll("{plan}", PLANS[b.plan].name)
      .replaceAll("{fecha}", formatDate(b.expiredAt, TZ, { day: "numeric", month: "long" }))
      .replaceAll("{codigo}", d.couponCode ?? "")
  const subject = fill(d.subject)
  const body = fill(d.body)
  if (d.kind === "oferta") {
    const unsub = unsubscribeUrl(to.id)
    return {
      to: to.email,
      ...promoEmail({
        name: to.name,
        subject,
        body,
        couponCode: d.couponCode,
        buttonLabel: fill(d.buttonLabel),
        buttonUrl: `${app}/dashboard/plan?codigo=${encodeURIComponent(d.couponCode ?? "")}#canjear`,
        unsubscribeUrl: unsub,
      }),
      headers: {
        "List-Unsubscribe": `<${unsub.replace("/baja?", "/api/baja?")}>, <mailto:contacto@ordensimple.cl?subject=baja>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }
  }
  return {
    to: to.email,
    ...directEmail({ name: to.name, subject, body, buttonLabel: fill(d.buttonLabel), buttonUrl: `${app}${checkoutPath(b.plan === "BUSINESS" ? "empresa" : "pro")}` }),
  }
}

async function prepare(input: ExpiredEmailInput) {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { error: validationError(parsed.error) }
  const d = parsed.data
  if (d.kind === "oferta") {
    if (!d.couponCode) return { error: { ok: false as const, message: "Elige el código de descuento que vas a ofrecer." } }
    const coupon = await db.coupon.findUnique({ where: { code: d.couponCode }, select: { active: true, expiresAt: true } })
    if (!coupon?.active || (coupon.expiresAt && coupon.expiresAt <= new Date())) {
      return { error: { ok: false as const, message: `El código ${d.couponCode} no existe, está pausado o ya venció.` } }
    }
  }
  const wanted = new Set(d.businessIds)
  const rows = (await listExpiredPlans()).filter((r) => wanted.has(r.id))
  return { data: d, rows }
}

/** Manda el correo del primer negocio elegido solo al administrador, para revisarlo antes. */
export async function sendExpiredPlanTest(input: ExpiredEmailInput): Promise<ActionResult> {
  const admin = await requireAdmin()
  const r = await prepare(input)
  if (r.error) return r.error
  const first = r.rows[0]
  if (!first) return { ok: false, message: "Esos negocios ya no tienen el plan vencido." }
  try {
    const email = build(r.data, first, { id: admin.id, name: admin.name, email: admin.email })
    await sendEmail({ ...email, to: admin.email, subject: `[Prueba] ${email.subject}` })
    return { ok: true, message: `Te enviamos una prueba a ${admin.email} (con los datos de ${first.name})` }
  } catch (error) {
    return toActionError(error)
  }
}

/** Envía el recordatorio o la oferta a los dueños de los negocios elegidos y lo deja en el historial de correos. */
export async function sendExpiredPlanEmails(input: ExpiredEmailInput): Promise<ActionResult> {
  const admin = await requireAdmin()
  const r = await prepare(input)
  if (r.error) return r.error
  const d = r.data
  const now = Date.now()
  const cooldown = EXPIRED_COOLDOWN_DAYS * 86_400_000

  const skipped = { recent: 0, optOut: 0, noOwner: 0 }
  const targets: { row: ExpiredPlanRow; owner: NonNullable<ExpiredPlanRow["owner"]> }[] = []
  for (const row of r.rows) {
    if (!row.owner) skipped.noOwner++
    else if (row.lastNotice && now - row.lastNotice.at.getTime() < cooldown) skipped.recent++
    else if (d.kind === "oferta" && !row.owner.marketingOptIn) skipped.optOut++
    else targets.push({ row, owner: row.owner })
  }
  // Una persona con varios negocios vencidos recibe un solo correo.
  const seen = new Set<string>()
  const unique = targets.filter((t) => (seen.has(t.owner.email) ? false : (seen.add(t.owner.email), true)))

  const notes = [
    skipped.recent ? `${skipped.recent} ya recibieron un correo en los últimos ${EXPIRED_COOLDOWN_DAYS} días` : null,
    skipped.optOut ? `${skipped.optOut} no aceptan ofertas` : null,
    skipped.noOwner ? `${skipped.noOwner} sin dueño` : null,
  ].filter(Boolean)
  if (!unique.length) return { ok: false, message: `No hay a quién enviarle: ${notes.join(", ") || "esos negocios ya no tienen el plan vencido"}.` }

  try {
    const campaign = await db.emailCampaign.create({
      data: {
        subject: d.subject,
        body: d.body,
        buttonLabel: d.buttonLabel,
        couponCode: d.kind === "oferta" ? (d.couponCode ?? null) : null,
        audience: EXPIRED_KINDS[d.kind],
        recipients: unique.length,
        toEmails: unique.map((t) => t.owner.email).join(", "),
        createdBy: admin.email,
      },
    })
    const { sent, failed } = await sendEmailBatch(unique.map((t) => build(d, t.row, t.owner)))
    await db.emailCampaign.update({ where: { id: campaign.id }, data: { sentCount: sent, failedCount: failed, sentAt: new Date() } })
    revalidatePath("/admin")
    if (sent === 0) return { ok: false, message: "No se pudo enviar el correo. Revisa la configuración de Resend." }
    const head = d.kind === "oferta" ? `Oferta enviada a ${sent} ${sent === 1 ? "persona" : "personas"}` : `Recordatorio enviado a ${sent} ${sent === 1 ? "persona" : "personas"}`
    return { ok: true, message: [head, failed ? `${failed} fallaron` : null, ...notes].filter(Boolean).join(" · ") }
  } catch (error) {
    return toActionError(error)
  }
}
