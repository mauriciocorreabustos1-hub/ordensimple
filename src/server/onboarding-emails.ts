import "server-only"
import { db } from "@/lib/db"
import { sendEmailBatch } from "@/lib/email"
import { nudgeEmail } from "@/lib/email-templates"
import { unsubscribeUrl } from "@/lib/unsubscribe"

const DAY = 86_400_000
/** Correo 1 al día 1, correo 2 al día 3, correo 3 al día 7 desde el registro. */
const STEPS = [
  { step: 1, afterDays: 1 },
  { step: 2, afterDays: 3 },
  { step: 3, afterDays: 7 },
] as const
/** Cuentas más antiguas no reciben la serie (evita escribirle de golpe a usuarios de antes). */
const MAX_AGE_DAYS = 10
const DONE = 3

/**
 * Envía el correo de bienvenida que corresponda a quienes aún no anotan ventas.
 * Se ejecuta una vez al día (Vercel Cron). Si una persona está atrasada, recibe solo el
 * último correo que le toca, nunca varios juntos.
 */
export async function sendOnboardingNudges(now = new Date()) {
  const users = await db.user.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - MAX_AGE_DAYS * DAY) }, nudgeStep: { lt: DONE } },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      nudgeStep: true,
      memberships: {
        select: { business: { select: { onboardingCompleted: true, _count: { select: { sales: true } } } } },
      },
    },
  })

  const emails: Parameters<typeof sendEmailBatch>[0] = []
  const updates: { id: string; step: number }[] = []

  for (const u of users) {
    // Ya anota ventas (o entró invitado a un negocio que las tiene): no necesita la serie.
    if (u.memberships.some((m) => m.business._count.sales > 0)) {
      updates.push({ id: u.id, step: DONE })
      continue
    }
    const ageDays = (now.getTime() - u.createdAt.getTime()) / DAY
    const due = [...STEPS].reverse().find((s) => ageDays >= s.afterDays && s.step > u.nudgeStep)
    if (!due) continue

    const unsub = unsubscribeUrl(u.id)
    emails.push({
      to: u.email,
      ...nudgeEmail({
        step: due.step,
        name: u.name,
        hasBusiness: u.memberships.some((m) => m.business.onboardingCompleted),
        unsubscribeUrl: unsub,
      }),
      headers: {
        "List-Unsubscribe": `<${unsub.replace("/baja?", "/api/baja?")}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    })
    updates.push({ id: u.id, step: due.step })
  }

  // Se marca antes de enviar: si el envío falla, se pierde un consejo, pero nunca se repite.
  await Promise.all(updates.map((x) => db.user.update({ where: { id: x.id }, data: { nudgeStep: x.step } })))
  const result = emails.length ? await sendEmailBatch(emails) : { sent: 0, failed: 0 }
  return { checked: users.length, ...result }
}
