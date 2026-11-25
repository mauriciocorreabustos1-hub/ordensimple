"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAppUrl } from "@/lib/app-url"
import { sendEmail, sendEmailBatch } from "@/lib/email"
import { reminderEmail } from "@/lib/email-templates"
import { unsubscribeUrl } from "@/lib/unsubscribe"
import { requireAdmin } from "@/server/admin"
import { getReminderSegments, REMINDER_COOLDOWN_DAYS, REMINDER_SEGMENTS, type ReminderPerson, type ReminderSegment } from "@/server/queries/sales-reminders"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

/** Máximo por envío, para no pasar el límite diario de correos (los demás quedan para otro día). */
const MAX_PER_SEND = 80

const schema = z.object({
  segment: z.enum(["configurar", "primera", "volver"]),
  subject: z.string().trim().min(3, "Escribe el asunto").max(150),
  body: z.string().trim().min(10, "Escribe el mensaje").max(5000),
  buttonLabel: z.string().trim().min(2, "Escribe el texto del botón").max(40),
  /** Solo a estas personas (desde Usuarios). Sin indicar: a todo el grupo. */
  userIds: z.array(z.string().min(1)).max(MAX_PER_SEND).optional(),
})
export type SalesReminderInput = z.input<typeof schema>

const buttonUrl = (segment: ReminderSegment) => `${getAppUrl()}${segment === "configurar" ? "/onboarding" : "/dashboard?registrar=venta"}`

function build(d: z.output<typeof schema>, person: Pick<ReminderPerson, "id" | "name" | "email" | "businessName" | "days">) {
  const fill = (s: string) =>
    s
      .replaceAll("{negocio}", person.businessName ?? "tu negocio")
      .replaceAll("{dias}", person.days !== null ? String(person.days) : "varios")
  const unsub = unsubscribeUrl(person.id)
  return {
    to: person.email,
    ...reminderEmail({ name: person.name, subject: fill(d.subject), body: fill(d.body), buttonLabel: fill(d.buttonLabel), buttonUrl: buttonUrl(d.segment), unsubscribeUrl: unsub }),
    headers: {
      "List-Unsubscribe": `<${unsub.replace("/baja?", "/api/baja?")}>, <mailto:contacto@ordensimple.cl?subject=baja>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  }
}

async function prepare(input: SalesReminderInput) {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { error: validationError(parsed.error) }
  const d = parsed.data
  const segments = await getReminderSegments()
  const group = segments[d.segment]
  const people = d.userIds ? group.people.filter((p) => d.userIds!.includes(p.id)) : group.people
  return { data: d, people, group }
}

/** Manda el correo (con los datos de la primera persona del grupo) solo al administrador, para revisarlo. */
export async function sendSalesReminderTest(input: SalesReminderInput): Promise<ActionResult> {
  const admin = await requireAdmin()
  const r = await prepare(input)
  if (r.error) return r.error
  const sample = r.people[0] ?? { id: admin.id, name: admin.name, email: admin.email, businessName: "Tu negocio", days: 20 }
  try {
    const email = build(r.data, { ...sample, id: admin.id, email: admin.email })
    await sendEmail({ ...email, to: admin.email, subject: `[Prueba] ${email.subject}` })
    return { ok: true, message: `Te enviamos una prueba a ${admin.email}${r.people[0] ? ` (con los datos de ${r.people[0].name})` : ""}` }
  } catch (error) {
    return toActionError(error)
  }
}

/** Envía el recordatorio al grupo (o a las personas elegidas) y lo deja en el historial de correos. */
export async function sendSalesReminders(input: SalesReminderInput): Promise<ActionResult> {
  const admin = await requireAdmin()
  const r = await prepare(input)
  if (r.error) return r.error
  const d = r.data
  if (!r.people.length) {
    return {
      ok: false,
      message: d.userIds
        ? `A esta persona no se le puede escribir ahora: ya recibió un recordatorio hace menos de ${REMINDER_COOLDOWN_DAYS} días, pidió no recibir consejos o está en la serie de bienvenida.`
        : "No hay a quién escribirle en este grupo hoy.",
    }
  }
  const batch = r.people.slice(0, MAX_PER_SEND)
  try {
    const campaign = await db.emailCampaign.create({
      data: {
        subject: d.subject,
        body: d.body,
        buttonLabel: d.buttonLabel,
        buttonUrl: buttonUrl(d.segment),
        audience: REMINDER_SEGMENTS[d.segment].audience,
        recipients: batch.length,
        toEmails: batch.map((p) => p.email).join(", "),
        createdBy: admin.email,
      },
    })
    const { sent, failed } = await sendEmailBatch(batch.map((p) => build(d, p)))
    await db.emailCampaign.update({ where: { id: campaign.id }, data: { sentCount: sent, failedCount: failed, sentAt: new Date() } })
    revalidatePath("/admin")
    if (sent === 0) return { ok: false, message: "No se pudo enviar el correo. Revisa la configuración de Resend." }
    const rest = r.people.length - batch.length
    return {
      ok: true,
      message: [
        `Recordatorio enviado a ${sent} ${sent === 1 ? "persona" : "personas"}`,
        failed ? `${failed} fallaron` : null,
        rest > 0 ? `quedan ${rest} para mañana (máximo ${MAX_PER_SEND} por envío)` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    }
  } catch (error) {
    return toActionError(error)
  }
}
