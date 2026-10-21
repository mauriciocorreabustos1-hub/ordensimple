import "server-only"
import { cache } from "react"
import { db } from "@/lib/db"
import { businessProfile } from "@/lib/business-kind"
import { readBookingHours, shiftDayKey, toMinutes, weekdayIndex } from "@/lib/booking"
import { toDateKey, zonedTimeToUtc } from "@/lib/dates"
import { canUseFeature, effectivePlan } from "@/lib/plans"
import { STORE_SLUG_RE } from "@/lib/store"
import type { Tx } from "@/server/sale-core"

/**
 * Negocio que recibe reservas en su página: tienda publicada, rubro de servicios, plan con Agenda y
 * reservas activadas. Si algo falta, no se puede reservar.
 */
export const getBookableBusiness = cache(async (slug: string) => {
  if (!STORE_SLUG_RE.test(slug)) return null
  const b = await db.business.findUnique({
    where: { storeSlug: slug },
    select: {
      id: true,
      name: true,
      type: true,
      timezone: true,
      currency: true,
      plan: true,
      planExpiresAt: true,
      storeEnabled: true,
      storeWhatsapp: true,
      settings: { select: { bookingEnabled: true, bookingHours: true, bookingSlotMin: true, bookingMinNoticeMin: true, bookingMaxDays: true } },
    },
  })
  if (!b || !b.storeEnabled || !b.storeWhatsapp) return null
  const plan = effectivePlan(b)
  if (!canUseFeature(plan, "store") || !canUseFeature(plan, "agenda") || !businessProfile(b.type).services) return null
  const s = b.settings
  if (s && !s.bookingEnabled) return null
  return {
    id: b.id,
    name: b.name,
    timezone: b.timezone,
    currency: b.currency,
    whatsapp: b.storeWhatsapp,
    hours: readBookingHours(s?.bookingHours),
    slotMin: s?.bookingSlotMin ?? 30,
    noticeMin: s?.bookingMinNoticeMin ?? 60,
    maxDays: s?.bookingMaxDays ?? 30,
  }
})

export type BookableBusiness = NonNullable<Awaited<ReturnType<typeof getBookableBusiness>>>

/** Servicios que se pueden reservar: activos, sin stock, con precio y duración. */
export function bookableServices(businessId: string) {
  return db.product.findMany({
    where: { businessId, active: true, trackStock: false, price: { gt: 0 }, durationMin: { not: null } },
    select: { id: true, name: true, price: true, durationMin: true },
    orderBy: { name: "asc" },
    take: 100,
  })
}

/** Quienes atienden (todo el equipo del negocio). */
export async function bookableStaff(businessId: string) {
  const members = await db.businessMember.findMany({
    where: { businessId },
    select: { userId: true, user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  })
  return members.map((m) => ({ id: m.userId, name: m.user.name }))
}

/** Días que se pueden elegir: desde hoy hasta el máximo, solo los que el negocio atiende. */
export function bookableDays(b: BookableBusiness, now = new Date()) {
  const today = toDateKey(now, b.timezone)
  return Array.from({ length: b.maxDays + 1 }, (_, i) => shiftDayKey(today, i)).filter((d) => b.hours[weekdayIndex(d)])
}

/**
 * Horas libres de un día para un servicio de cierta duración. Para cada hora dice qué profesionales están libres.
 * Las citas sin profesional asignado ocupan "a alguien": se descuentan del total libre.
 */
export async function freeSlots(
  client: Pick<Tx, "appointment">,
  b: BookableBusiness,
  day: string,
  durationMin: number,
  staffIds: string[],
  /** Si el cliente eligió a alguien en particular. */
  wanted?: string | null,
  now = new Date(),
) {
  const hours = b.hours[weekdayIndex(day)]
  if (!hours || !staffIds.length) return []
  const [y, m, d] = day.split("-").map(Number)
  const at = (min: number) => zonedTimeToUtc(y, m, d, b.timezone, Math.floor(min / 60), min % 60)
  const open = toMinutes(hours.open)
  const close = toMinutes(hours.close)
  const busy = await client.appointment.findMany({
    where: { businessId: b.id, startAt: { lt: at(close) }, endAt: { gt: at(open) }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
    select: { staffId: true, startAt: true, endAt: true },
  })
  const earliest = now.getTime() + b.noticeMin * 60_000
  const slots: { time: string; staffIds: string[] }[] = []
  for (let t = open; t + durationMin <= close; t += b.slotMin) {
    const start = at(t)
    const end = at(t + durationMin)
    if (start.getTime() < earliest) continue
    const overlapping = busy.filter((a) => a.startAt < end && a.endAt > start)
    const free = staffIds.filter((id) => !overlapping.some((a) => a.staffId === id))
    const unassigned = overlapping.filter((a) => !a.staffId || !staffIds.includes(a.staffId)).length
    if (free.length - unassigned <= 0) continue
    if (wanted && !free.includes(wanted)) continue
    slots.push({ time: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`, staffIds: wanted ? [wanted] : free })
  }
  return slots
}
