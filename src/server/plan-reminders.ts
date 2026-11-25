import "server-only"
import { getAppUrl } from "@/lib/app-url"
import { formatDate, toDateKey } from "@/lib/dates"
import { db } from "@/lib/db"
import { sendEmailBatch } from "@/lib/email"
import { planEndingEmail } from "@/lib/email-templates"
import { checkoutPath, PLANS } from "@/lib/plans"

import { alreadyNotified, calendarDaysBetween, cleanDateLabel, PLAN_NOTICE_DAYS, planNoticeStage } from "@/lib/plan-notice"

const DAY = 86_400_000

/**
 * Avisa al dueño y a los administradores que el plan está por vencer (5 días antes) y el día que vence. Se ejecuta
 * una vez al día. No avisa a quien paga con suscripción automática (se renueva sola) ni al Pro permanente (no vence),
 * y nunca repite el mismo aviso: queda anotado en el negocio.
 */
export async function sendPlanReminders(now = new Date()) {
  const businesses = await db.business.findMany({
    where: {
      plan: { not: "FREE" },
      // Un poco más amplio que 5 días: el corte exacto se hace por fecha en la zona de cada negocio.
      planExpiresAt: { gt: new Date(now.getTime() - 2 * DAY), lte: new Date(now.getTime() + (PLAN_NOTICE_DAYS + 1) * DAY) },
      // Con una suscripción activa o pausada por un regalo, el cobro sigue solo: no hay nada que avisar.
      subscriptions: { none: { status: { in: ["authorized", "paused"] } } },
    },
    select: {
      id: true,
      name: true,
      plan: true,
      planExpiresAt: true,
      timezone: true,
      planNoticeKey: true,
      members: { where: { role: { in: ["OWNER", "ADMIN"] } }, select: { user: { select: { name: true, email: true } } } },
    },
  })

  const app = getAppUrl()
  let sent = 0
  for (const b of businesses) {
    const day = toDateKey(b.planExpiresAt!, b.timezone)
    const days = calendarDaysBetween(toDateKey(now, b.timezone), day)
    const stage = planNoticeStage(days)
    if (!stage) continue
    const key = `${day}:${stage}`
    // Ya se mandó este aviso, o ya se mandó el del día (que es posterior al de 5 días).
    if (alreadyNotified(b.planNoticeKey, day, stage)) continue
    if (!b.members.length) continue
    const planName = PLANS[b.plan].name
    const endsLabel = cleanDateLabel(`el ${formatDate(b.planExpiresAt!, b.timezone, { weekday: "long", day: "numeric", month: "long" })}`)
    const url = `${app}${checkoutPath(b.plan === "BUSINESS" ? "empresa" : "pro")}`
    const result = await sendEmailBatch(
      b.members.map((m) => ({ to: m.user.email, ...planEndingEmail({ name: m.user.name, planName, businessName: b.name, endsLabel, daysLeft: Math.max(0, days), url }) })),
    )
    // Solo se anota si salió al menos uno: si falló, se reintenta mañana.
    if (result.sent > 0) {
      await db.business.update({ where: { id: b.id }, data: { planNoticeKey: key } })
      sent += result.sent
    }
  }
  return { negocios: businesses.length, correos: sent }
}

/**
 * Aviso dentro de la app (arriba de cada pantalla) para el dueño o administrador: el plan vence en 7 días o menos, o
 * venció hace menos de 14. Null si no hay nada que avisar (Gratis, Pro permanente o pago automático activo).
 */
export async function planBannerFor(businessId: string, timezone: string, now = new Date()) {
  const b = await db.business.findUnique({
    where: { id: businessId },
    select: { plan: true, planExpiresAt: true, _count: { select: { subscriptions: { where: { status: { in: ["authorized", "paused"] } } } } } },
  })
  if (!b || b.plan === "FREE" || !b.planExpiresAt || b._count.subscriptions > 0) return null
  const ended = b.planExpiresAt <= now
  const days = calendarDaysBetween(toDateKey(now, timezone), toDateKey(b.planExpiresAt, timezone))
  if (days > 7 || days < -14) return null
  return {
    planName: PLANS[b.plan].name,
    endsLabel: cleanDateLabel(`el ${formatDate(b.planExpiresAt, timezone, ended ? { day: "numeric", month: "long" } : { weekday: "long", day: "numeric", month: "long" })}`),
    daysLeft: ended ? -1 : Math.max(0, days),
    href: checkoutPath(b.plan === "BUSINESS" ? "empresa" : "pro"),
  }
}
