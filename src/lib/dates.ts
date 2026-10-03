// Fechas calculadas en la zona horaria del negocio, sin dependencias externas.

export const DEFAULT_TIMEZONE = "America/Santiago"

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number }

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getParts(date: Date, timeZone: string): Parts {
  let f = partsFormatterCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    partsFormatterCache.set(timeZone, f)
  }
  const out: Record<string, number> = {}
  for (const p of f.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value)
  }
  return out as Parts
}

/** Diferencia en ms entre la hora local de la zona y UTC para un instante. */
function tzOffset(date: Date, timeZone: string) {
  const p = getParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** Instante UTC que corresponde a una fecha/hora "de pared" en la zona. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
  hour = 0,
  minute = 0,
) {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const first = guess - tzOffset(new Date(guess), timeZone)
  // Segunda pasada para cambios de horario.
  const second = guess - tzOffset(new Date(first), timeZone)
  return new Date(second)
}

export function zonedParts(date: Date, timeZone: string) {
  return getParts(date, timeZone)
}

export function startOfDay(date: Date, timeZone: string) {
  const p = getParts(date, timeZone)
  return zonedTimeToUtc(p.year, p.month, p.day, timeZone)
}

export function addDays(date: Date, days: number, timeZone: string) {
  const p = getParts(date, timeZone)
  return zonedTimeToUtc(p.year, p.month, p.day + days, timeZone, p.hour, p.minute)
}

export function startOfMonth(date: Date, timeZone: string, monthOffset = 0) {
  const p = getParts(date, timeZone)
  return zonedTimeToUtc(p.year, p.month + monthOffset, 1, timeZone)
}

/** Lunes de la semana en curso. */
export function startOfWeek(date: Date, timeZone: string) {
  const p = getParts(date, timeZone)
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() // 0 = domingo
  const diff = (weekday + 6) % 7
  return zonedTimeToUtc(p.year, p.month, p.day - diff, timeZone)
}

/** "2026-10-03" en la zona del negocio (para inputs type=date y agrupaciones). */
export function toDateKey(date: Date, timeZone: string) {
  const p = getParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

export function toMonthKey(date: Date, timeZone: string) {
  const p = getParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, "0")}`
}

/** Convierte "2026-10-03" en el inicio de ese día en la zona. */
export function dateKeyToUtc(key: string, timeZone: string) {
  const [y, m, d] = key.split("-").map(Number)
  return zonedTimeToUtc(y, m, d, timeZone)
}

/**
 * Fecha elegida en un formulario: si es hoy se usa la hora actual,
 * si es otro día se guarda al mediodía para evitar saltos de zona horaria.
 */
export function dateKeyToInstant(key: string, timeZone: string, now = new Date()) {
  if (key === toDateKey(now, timeZone)) return now
  const [y, m, d] = key.split("-").map(Number)
  return zonedTimeToUtc(y, m, d, timeZone, 12)
}

export function daysInMonth(date: Date, timeZone: string) {
  const p = getParts(date, timeZone)
  return new Date(Date.UTC(p.year, p.month, 0)).getUTCDate()
}

export function formatDate(
  date: Date,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  return new Intl.DateTimeFormat("es-CL", { timeZone, ...opts }).format(date)
}

export function formatDateTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("es-CL", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date)
}

export function monthName(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("es-CL", { timeZone, month: "long" }).format(date)
}

export function greeting(date: Date, timeZone: string) {
  const { hour } = getParts(date, timeZone)
  if (hour < 12) return "Buenos días"
  if (hour < 20) return "Buenas tardes"
  return "Buenas noches"
}
