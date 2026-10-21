"use server"

import { headers } from "next/headers"
import { after } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { formatDate, zonedTimeToUtc } from "@/lib/dates"
import { optionalText } from "@/lib/validations"
import { allowAttempt } from "@/server/rate-limit"
import { bookableDays, bookableServices, bookableStaff, freeSlots, getBookableBusiness } from "@/server/booking"
import { businessManagers, sendPush } from "@/server/push"
import { webCustomer } from "@/server/web-customer"
import { validationError, type ActionResult } from "@/server/actions/result"

const id = z.string().min(1).max(40)
const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip"
}

const NOT_AVAILABLE = "Este negocio no está recibiendo reservas en este momento."

/** Horas libres de un día para un servicio (y un profesional, si lo eligió). */
export async function getBookingSlots(input: { slug: string; productId: string; staffId?: string | null; day: string }): Promise<ActionResult<{ times: string[] }>> {
  const parsed = z.object({ slug: z.string().max(40), productId: id, staffId: id.nullable().optional(), day: dayKey }).safeParse(input)
  if (!parsed.success) return { ok: false, message: "Datos no válidos." }
  const { slug, productId, staffId, day } = parsed.data
  if (!(await allowAttempt(`reserva-horas:${await clientIp()}`, 240, 60 * 60_000))) return { ok: false, message: "Demasiadas consultas seguidas. Espera un momento." }
  const b = await getBookableBusiness(slug)
  if (!b) return { ok: false, message: NOT_AVAILABLE }
  if (!bookableDays(b).includes(day)) return { ok: true, data: { times: [] } }
  const [services, staff] = await Promise.all([bookableServices(b.id), bookableStaff(b.id)])
  const service = services.find((s) => s.id === productId)
  if (!service) return { ok: false, message: "Ese servicio ya no está disponible." }
  if (staffId && !staff.some((s) => s.id === staffId)) return { ok: false, message: "Esa persona ya no atiende aquí." }
  const slots = await freeSlots(db, b, day, service.durationMin!, staff.map((s) => s.id), staffId)
  return { ok: true, data: { times: slots.map((s) => s.time) } }
}

const bookingSchema = z.object({
  slug: z.string().max(40),
  productId: id,
  staffId: id.nullable().optional(),
  day: dayKey,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  customerName: z.string().trim().min(2, "Escribe tu nombre").max(60, "Máximo 60 caracteres"),
  customerPhone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v.replace(/\D/g, "").length >= 8, "Escribe tu teléfono (para confirmarte la hora)"),
  note: optionalText(200),
  /** Campo trampa para robots. */
  website: z.string().max(200).optional(),
})

/** El cliente reserva su hora desde la página del negocio. Se revisa de nuevo que la hora siga libre. */
export async function createBooking(
  input: z.input<typeof bookingSchema>,
): Promise<ActionResult<{ code: string; serviceName: string; staffName: string | null; dayLabel: string; time: string; whatsapp: string; businessName: string }>> {
  const parsed = bookingSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const d = parsed.data
  if (d.website) return { ok: false, message: "No se pudo reservar." }
  const ip = await clientIp()
  if (!(await allowAttempt(`reserva:${ip}`, 5, 60 * 60_000)) || !(await allowAttempt(`reserva-negocio:${d.slug}`, 60, 60 * 60_000))) {
    return { ok: false, message: "Se hicieron muchas reservas seguidas. Espera un rato o escríbele directo al negocio." }
  }
  const b = await getBookableBusiness(d.slug)
  if (!b) return { ok: false, message: NOT_AVAILABLE }
  if (!bookableDays(b).includes(d.day)) return { ok: false, message: "Ese día no hay atención. Elige otro." }
  const [services, staff] = await Promise.all([bookableServices(b.id), bookableStaff(b.id)])
  const service = services.find((s) => s.id === d.productId)
  if (!service) return { ok: false, message: "Ese servicio ya no está disponible." }
  if (d.staffId && !staff.some((s) => s.id === d.staffId)) return { ok: false, message: "Esa persona ya no atiende aquí." }

  const [y, m, day] = d.day.split("-").map(Number)
  const startAt = zonedTimeToUtc(y, m, day, b.timezone, Number(d.time.slice(0, 2)), Number(d.time.slice(3, 5)))
  const endAt = new Date(startAt.getTime() + service.durationMin! * 60_000)

  const result = await db.$transaction(async (tx) => {
    // El mismo candado que la Agenda del negocio: dos personas no pueden tomar la misma hora.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"agenda:" + b.id}))`
    const slot = (await freeSlots(tx, b, d.day, service.durationMin!, staff.map((s) => s.id), d.staffId)).find((s) => s.time === d.time)
    if (!slot) return null
    const staffId = slot.staffIds[0]
    const customerId = await webCustomer(tx, b.id, d.customerName, d.customerPhone, "Reservó hora en la página")
    const a = await tx.appointment.create({
      data: {
        businessId: b.id,
        customerId,
        customerName: d.customerName,
        customerPhone: d.customerPhone,
        productId: service.id,
        serviceName: service.name,
        price: service.price,
        staffId,
        startAt,
        endAt,
        note: d.note ?? null,
        source: "ONLINE",
      },
      select: { id: true },
    })
    return { id: a.id, staffId }
  })
  if (!result) return { ok: false, message: "Alguien acaba de tomar esa hora. Elige otra, por favor." }

  const staffName = staff.find((s) => s.id === result.staffId)?.name ?? null
  const dayLabel = formatDate(startAt, b.timezone, { weekday: "long", day: "numeric", month: "long" })
  // Aviso al celular del dueño, los administradores y quien atiende.
  after(async () =>
    sendPush([...(await businessManagers(b.id)), result.staffId], {
      title: `📅 Nueva reserva: ${d.customerName}`,
      body: `${dayLabel} a las ${d.time} · ${service.name}${staffName ? ` · con ${staffName.split(" ")[0]}` : ""}`,
      url: `/dashboard/agenda?dia=${d.day}`,
      tag: `reserva-${result.id}`,
    }),
  )
  return {
    ok: true,
    message: "Hora reservada",
    data: {
      code: result.id.slice(-5).toUpperCase(),
      serviceName: service.name,
      staffName: staffName ? staffName.split(" ")[0] : null,
      dayLabel,
      time: d.time,
      whatsapp: b.whatsapp,
      businessName: b.name,
    },
  }
}
