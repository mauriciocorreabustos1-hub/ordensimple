import { dateKeyToUtc, formatDate, zonedParts } from "@/lib/dates"

/** Impuesto al valor agregado de cada país (tasa general). Sin dato = el país no usa este cálculo. */
const VAT_BY_COUNTRY: Record<string, { rate: number; label: string; form?: string }> = {
  CL: { rate: 0.19, label: "IVA", form: "Formulario 29" },
  PE: { rate: 0.18, label: "IGV" },
  AR: { rate: 0.21, label: "IVA" },
  CO: { rate: 0.19, label: "IVA" },
  MX: { rate: 0.16, label: "IVA" },
  ES: { rate: 0.21, label: "IVA" },
}

export function vatInfo(country: string) {
  return VAT_BY_COUNTRY[country] ?? null
}

/** IVA contenido en un monto que ya lo incluye. Ej. Chile: $11.900 → $1.900. */
export function vatFromGross(gross: number, rate: number) {
  return Math.round((gross * rate) / (1 + rate))
}

// ─── Feriados de Chile (para correr el vencimiento del F29) ────────────────

const key = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`

/** Domingo de Pascua (algoritmo de Meeus). */
function easter(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return Date.UTC(year, month - 1, day)
}

/** Feriado que se corre al lunes (Ley 19.668): martes y miércoles al lunes anterior; jueves y viernes al siguiente. */
function moveToMonday(year: number, month: number, day: number) {
  const t = Date.UTC(year, month - 1, day)
  const shift = [0, 0, -1, -2, 4, 3, 0][new Date(t).getUTCDay()]
  return new Date(t + shift * 86_400_000)
}

const holidayCache = new Map<number, Set<string>>()
/** Feriados nacionales de Chile de un año, como "AAAA-MM-DD". */
export function chileHolidays(year: number) {
  const cached = holidayCache.get(year)
  if (cached) return cached
  const days = new Set<string>()
  const add = (d: Date) => days.add(key(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()))
  for (const [m, d] of [[1, 1], [5, 1], [5, 21], [7, 16], [8, 15], [9, 18], [9, 19], [11, 1], [12, 8], [12, 25]]) days.add(key(year, m, d))
  const e = easter(year)
  add(new Date(e - 2 * 86_400_000)) // Viernes Santo
  add(new Date(e - 1 * 86_400_000)) // Sábado Santo
  // Pueblos Indígenas: el día del solsticio de invierno en Chile (20 de junio en los años 4n y 4n+1, 21 en el resto; vale 2024-2040).
  days.add(key(year, 6, year % 4 <= 1 ? 20 : 21))
  add(moveToMonday(year, 6, 29)) // San Pedro y San Pablo
  add(moveToMonday(year, 10, 12)) // Encuentro de Dos Mundos
  // Iglesias Evangélicas: si cae martes se pasa al viernes anterior; si cae miércoles, al viernes siguiente.
  const oct31 = Date.UTC(year, 9, 31)
  const wd = new Date(oct31).getUTCDay()
  add(new Date(oct31 + (wd === 2 ? -4 : wd === 3 ? 2 : 0) * 86_400_000))
  // Si el 18 de septiembre cae martes, el lunes 17 también es feriado; si el 19 cae jueves, el viernes 20 también.
  const sep18 = new Date(Date.UTC(year, 8, 18)).getUTCDay()
  if (sep18 === 2) days.add(key(year, 9, 17))
  if (sep18 === 3) days.add(key(year, 9, 20))
  holidayCache.set(year, days)
  return days
}

/**
 * Fecha en que vence el pago del IVA de un mes: el día indicado del mes siguiente.
 * Si cae sábado, domingo o (en Chile) feriado, se corre al siguiente día hábil, como en el F29.
 */
export function vatDueDate(year: number, month: number, dueDay: number, timeZone: string, country = "CL") {
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  let t = Date.UTC(nextYear, nextMonth - 1, dueDay)
  const isOff = (ms: number) => {
    const d = new Date(ms)
    const wd = d.getUTCDay()
    if (wd === 0 || wd === 6) return true
    return country === "CL" && chileHolidays(d.getUTCFullYear()).has(key(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()))
  }
  while (isOff(t)) t += 86_400_000
  const d = new Date(t)
  return dateKeyToUtc(key(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), timeZone)
}

/** Opciones de tasa de PPM (Chile) para elegir en Configuración. */
export const PPM_OPTIONS = [
  { value: 0.00125, label: "0,125%", hint: "Pro Pyme General" },
  { value: 0.002, label: "0,2%", hint: "Pro Pyme Transparente" },
  { value: 0.01, label: "1%", hint: "Régimen general" },
  { value: 0, label: "No mostrar", hint: "" },
] as const

/** Pago provisional mensual: un porcentaje de las ventas sin IVA del mes. */
export function ppmAmount(netSales: number, rate: number) {
  return rate > 0 && netSales > 0 ? Math.round(netSales * rate) : 0
}

/** Días que faltan (en el calendario del negocio) para una fecha. Negativo si ya pasó. */
export function daysUntil(date: Date, now: Date, timeZone: string) {
  const a = zonedParts(now, timeZone)
  const b = zonedParts(date, timeZone)
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000)
}

export function formatDueDate(date: Date, timeZone: string) {
  return formatDate(date, timeZone, { weekday: "long", day: "numeric", month: "long" })
}
