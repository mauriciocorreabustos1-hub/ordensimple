// Cómo se vende cada producto: por unidad, por kilo o por metro. En kilos y metros el precio es por kilo o por metro
// y la cantidad lleva decimales: hasta gramos (0,001 kg) y hasta centímetros (0,01 m).

export const SALE_UNITS = ["u", "kg", "m"] as const
export type SaleUnit = (typeof SALE_UNITS)[number]

export const SALE_UNIT_INFO: Record<SaleUnit, { label: string; per: string; short: string; decimals: number; example: string }> = {
  u: { label: "Por unidad", per: "unidad", short: "", decimals: 0, example: "2" },
  kg: { label: "Por kilo", per: "kilo", short: "kg", decimals: 3, example: "0,350" },
  m: { label: "Por metro", per: "metro", short: "m", decimals: 2, example: "1,5" },
}

export const isSaleUnit = (value: unknown): value is SaleUnit => typeof value === "string" && (SALE_UNITS as readonly string[]).includes(value)
export const saleUnitOf = (value: unknown): SaleUnit => (isSaleUnit(value) ? value : "u")
export const allowsDecimals = (unit: unknown) => saleUnitOf(unit) !== "u"

/** Redondea a la precisión de la medida (gramos o centímetros), para no arrastrar errores de los decimales. */
export function roundQuantity(quantity: number, unit: unknown) {
  const f = 10 ** SALE_UNIT_INFO[saleUnitOf(unit)].decimals
  return Math.round(quantity * f) / f
}

/** ¿La cantidad sirve para esa medida? Por unidad, solo enteros; por kilo o metro, hasta gramos o centímetros. */
export function validQuantity(quantity: number, unit: unknown) {
  return Number.isFinite(quantity) && quantity > 0 && Math.abs(roundQuantity(quantity, unit) - quantity) < 1e-9
}

/** Para leerla: "2", "1,5 m", "0,35 kg". */
export function formatQuantity(quantity: number, unit: unknown) {
  const u = saleUnitOf(unit)
  const info = SALE_UNIT_INFO[u]
  const text = roundQuantity(quantity, u).toLocaleString("es-CL", { maximumFractionDigits: info.decimals, useGrouping: true })
  return info.short ? `${text} ${info.short}` : text
}

/** "2 × Pan" por unidad; "1,5 m de Tela" por kilo o metro. */
export function quantityText(quantity: number, unit: unknown, description: string) {
  return allowsDecimals(unit) ? `${formatQuantity(quantity, unit)} de ${description}` : `${formatQuantity(quantity, unit)} × ${description}`
}

/** Lo que escribe la persona ("1,5" o "1.5") como número, redondeado a la medida. Null si no es una cantidad. */
export function parseQuantity(text: string, unit: unknown) {
  const clean = text.trim().replace(/\s/g, "").replace(",", ".")
  if (!/^\d+(\.\d+)?$/.test(clean)) return null
  const value = roundQuantity(Number(clean), unit)
  return value > 0 ? value : null
}

/** El total de una línea: cantidad por precio, en pesos enteros. */
export const lineTotal = (quantity: number, unitPrice: number) => Math.round(quantity * unitPrice)
