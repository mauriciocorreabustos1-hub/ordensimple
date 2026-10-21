/** Horario de un día: abre y cierra ("HH:MM"), o null si ese día no atiende. */
export type DayHours = { open: string; close: string } | null
/** Lunes a domingo. */
export type BookingHours = DayHours[]

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

/** Horario con que parte un negocio si todavía no lo ajusta. */
export const DEFAULT_BOOKING_HOURS: BookingHours = [
  { open: "09:00", close: "19:00" },
  { open: "09:00", close: "19:00" },
  { open: "09:00", close: "19:00" },
  { open: "09:00", close: "19:00" },
  { open: "09:00", close: "19:00" },
  { open: "10:00", close: "14:00" },
  null,
]

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Lo guardado en la base, revisado (si viene algo raro se usa el horario de siempre). */
export function readBookingHours(raw: unknown): BookingHours {
  if (!Array.isArray(raw) || raw.length !== 7) return DEFAULT_BOOKING_HOURS
  return raw.map((d) => {
    if (!d || typeof d !== "object") return null
    const { open, close } = d as { open?: unknown; close?: unknown }
    return typeof open === "string" && typeof close === "string" && HHMM.test(open) && HHMM.test(close) && open < close ? { open, close } : null
  })
}

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** Día de la semana de una fecha "AAAA-MM-DD" (0 = lunes … 6 = domingo). */
export function weekdayIndex(day: string) {
  return (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7
}

/** Fecha "AAAA-MM-DD" ± días. */
export function shiftDayKey(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
