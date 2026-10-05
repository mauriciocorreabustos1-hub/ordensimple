import { addDays, dateKeyToUtc, formatDate, zonedParts } from "@/lib/dates"

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

/**
 * Fecha en que vence el pago del IVA de un mes: el día indicado del mes siguiente.
 * Si cae sábado o domingo se corre al lunes (los festivos no se consideran).
 */
export function vatDueDate(year: number, month: number, dueDay: number, timeZone: string) {
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  let due = dateKeyToUtc(`${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`, timeZone)
  const weekday = new Date(Date.UTC(nextYear, nextMonth - 1, dueDay)).getUTCDay()
  if (weekday === 6) due = addDays(due, 2, timeZone)
  if (weekday === 0) due = addDays(due, 1, timeZone)
  return due
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
