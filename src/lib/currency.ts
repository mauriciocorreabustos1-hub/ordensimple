// Montos guardados como enteros en la unidad mínima de cada moneda.
// CLP: 15000 = $15.000 · USD: 1250 = US$12,50

export type CurrencyCode = "CLP" | "USD" | "EUR" | "PEN" | "ARS" | "COP" | "MXN"

type CurrencyConfig = {
  code: CurrencyCode
  name: string
  decimals: number
  locale: string
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  CLP: { code: "CLP", name: "Peso chileno", decimals: 0, locale: "es-CL" },
  USD: { code: "USD", name: "Dólar estadounidense", decimals: 2, locale: "es-CL" },
  EUR: { code: "EUR", name: "Euro", decimals: 2, locale: "es-ES" },
  PEN: { code: "PEN", name: "Sol peruano", decimals: 2, locale: "es-PE" },
  ARS: { code: "ARS", name: "Peso argentino", decimals: 2, locale: "es-AR" },
  COP: { code: "COP", name: "Peso colombiano", decimals: 0, locale: "es-CO" },
  MXN: { code: "MXN", name: "Peso mexicano", decimals: 2, locale: "es-MX" },
}

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[]

export function getCurrency(code: string | null | undefined): CurrencyConfig {
  return CURRENCIES[(code ?? "CLP") as CurrencyCode] ?? CURRENCIES.CLP
}

const formatterCache = new Map<string, Intl.NumberFormat>()

function formatter(code: string, compact: boolean) {
  const key = `${code}-${compact}`
  let f = formatterCache.get(key)
  if (!f) {
    const c = getCurrency(code)
    f = new Intl.NumberFormat(c.locale, {
      style: "currency",
      currency: c.code,
      minimumFractionDigits: compact ? 0 : c.decimals,
      maximumFractionDigits: compact ? 1 : c.decimals,
      notation: compact ? "compact" : "standard",
    })
    formatterCache.set(key, f)
  }
  return f
}

/** Convierte unidades mínimas (15000) en texto ($15.000). */
export function formatMoney(minor: number, code: string = "CLP", opts?: { compact?: boolean }) {
  const c = getCurrency(code)
  const value = Math.abs(minor) / 10 ** c.decimals
  const text = formatter(c.code, opts?.compact ?? false).format(value)
  return minor < 0 ? `-${text}` : text
}

/** Convierte el monto que escribe la persona ("25.000" o "12,50") en unidades mínimas. */
export function parseMoney(input: string, code: string = "CLP"): number {
  const c = getCurrency(code)
  const cleaned = input.replace(/[^\d,]/g, "")
  if (!cleaned) return 0
  if (c.decimals === 0) return Number(cleaned.replace(/,/g, "")) || 0
  const [whole, frac = ""] = cleaned.split(",")
  const fracPadded = (frac + "0".repeat(c.decimals)).slice(0, c.decimals)
  return Number(whole || "0") * 10 ** c.decimals + Number(fracPadded || "0")
}

/** Texto para mostrar dentro de un input mientras se escribe (sin símbolo). */
export function formatMoneyInput(minor: number, code: string = "CLP") {
  const c = getCurrency(code)
  const value = minor / 10 ** c.decimals
  return new Intl.NumberFormat(c.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: c.decimals,
  }).format(value)
}

export function currencySymbol(code: string = "CLP") {
  const c = getCurrency(code)
  const part = new Intl.NumberFormat(c.locale, { style: "currency", currency: c.code })
    .formatToParts(0)
    .find((p) => p.type === "currency")
  return part?.value ?? "$"
}

export function formatNumber(n: number, maxDecimals = 0) {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: maxDecimals }).format(n)
}

export function formatPercent(ratio: number, maxDecimals = 1) {
  return new Intl.NumberFormat("es-CL", {
    style: "percent",
    maximumFractionDigits: maxDecimals,
  }).format(ratio)
}

/** "Por cada $10.000" en la moneda del negocio (10.000 unidades enteras). */
export function referenceAmount(code: string = "CLP") {
  const c = getCurrency(code)
  const base = c.decimals === 0 ? 10000 : 100
  return base * 10 ** c.decimals
}
