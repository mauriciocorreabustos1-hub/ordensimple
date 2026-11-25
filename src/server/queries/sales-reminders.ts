import "server-only"
import { db } from "@/lib/db"

/** Grupos para recordar que anoten ventas. El "público" se guarda así en el historial de correos. */
export const REMINDER_SEGMENTS = {
  configurar: { audience: "RECORDAR_CONFIGURAR", label: "No terminaron de configurar", hint: "Crearon su cuenta pero no su negocio." },
  primera: { audience: "RECORDAR_PRIMERA", label: "Nunca anotaron una venta", hint: "Tienen su negocio listo y cero ventas." },
  volver: { audience: "RECORDAR_VOLVER", label: "Dejaron de anotar", hint: "Vendían, pero llevan 14 días o más sin anotar." },
} as const
export type ReminderSegment = keyof typeof REMINDER_SEGMENTS
export const REMINDER_SEGMENT_KEYS = Object.keys(REMINDER_SEGMENTS) as ReminderSegment[]

const DAY = 86_400_000
/** Días mínimos entre dos recordatorios a la misma persona. */
export const REMINDER_COOLDOWN_DAYS = 7
/** "Dejaron de anotar": sin ventas hace al menos esto, y no más que lo otro (más antiguos ya no responden). */
const STOPPED_MIN_DAYS = 14
const STOPPED_MAX_DAYS = 180
/** La serie automática de bienvenida cubre los primeros 10 días: no se les escribe encima. */
const SERIES_DAYS = 10
/** Valor de nudgeStep cuando la persona pidió no recibir más consejos (ver unsubscribe). */
const NO_TIPS = 99

export type ReminderPerson = { id: string; name: string; email: string; businessName: string | null; days: number | null; createdAt: Date }

/**
 * Quién está en cada grupo y a quién se le puede escribir hoy. Se omite a quien pidió no recibir consejos, a quien
 * todavía recibe la serie de bienvenida y a quien ya recibió un recordatorio hace menos de 7 días.
 */
export async function getReminderSegments(now = new Date()) {
  const [users, recent] = await Promise.all([
    db.user.findMany({
      where: { createdAt: { lt: new Date(now.getTime() - 2 * DAY) } },
      take: 5000,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        nudgeStep: true,
        memberships: {
          select: {
            role: true,
            business: { select: { name: true, onboardingCompleted: true, _count: { select: { sales: true } }, sales: { orderBy: { date: "desc" }, take: 1, select: { date: true } } } },
          },
        },
      },
    }),
    db.emailCampaign.findMany({
      where: { audience: { in: Object.values(REMINDER_SEGMENTS).map((s) => s.audience) }, createdAt: { gte: new Date(now.getTime() - REMINDER_COOLDOWN_DAYS * DAY) } },
      select: { toEmails: true },
    }),
  ])
  const cooling = new Set(recent.flatMap((c) => (c.toEmails ?? "").split(",").map((e) => e.trim().toLowerCase())).filter(Boolean))

  const result = Object.fromEntries(
    REMINDER_SEGMENT_KEYS.map((k) => [k, { people: [] as ReminderPerson[], skipped: { cooling: 0, noTips: 0, series: 0 } }]),
  ) as Record<ReminderSegment, { people: ReminderPerson[]; skipped: { cooling: number; noTips: number; series: number } }>

  for (const u of users) {
    const ready = u.memberships.filter((m) => m.business.onboardingCompleted)
    let segment: ReminderSegment | null = null
    let businessName: string | null = null
    let days: number | null = null
    if (!ready.length) segment = "configurar"
    else {
      // El negocio que más vendió es el que cuenta (alguien puede estar en varios).
      const withSales = ready.filter((m) => m.business._count.sales > 0)
      if (withSales.length) {
        const last = Math.max(...withSales.map((m) => m.business.sales[0]?.date.getTime() ?? 0))
        const ago = Math.floor((now.getTime() - last) / DAY)
        const owner = withSales.find((m) => m.role === "OWNER")
        if (owner && ago >= STOPPED_MIN_DAYS && ago <= STOPPED_MAX_DAYS) {
          segment = "volver"
          businessName = owner.business.name
          days = ago
        }
      } else {
        const owner = ready.find((m) => m.role === "OWNER")
        if (owner) {
          segment = "primera"
          businessName = owner.business.name
        }
      }
    }
    if (!segment) continue
    const bucket = result[segment]
    if (u.nudgeStep === NO_TIPS) bucket.skipped.noTips++
    else if (segment !== "volver" && now.getTime() - u.createdAt.getTime() < SERIES_DAYS * DAY && u.nudgeStep < 3) bucket.skipped.series++
    else if (cooling.has(u.email.toLowerCase())) bucket.skipped.cooling++
    else bucket.people.push({ id: u.id, name: u.name, email: u.email, businessName, days, createdAt: u.createdAt })
  }
  // Los más recientes primero: son los que más probablemente respondan.
  for (const k of REMINDER_SEGMENT_KEYS) result[k].people.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return result
}
