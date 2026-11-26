import { createHash, createHmac, randomBytes } from "node:crypto"
import { BlockList, isIPv4, isIPv6 } from "node:net"

// API pública v1 (la que usa OrdenCRM). Lógica pura, sin base de datos, para poder probarla.
// Contrato: pagina-ordencrm/ordensimple-api/openapi.yaml

export const API_KEY_PREFIX = "os_live_"
const KEY_RE = /^os_live_[A-Za-z0-9]{40}$/
const BASE62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

/** Clave nueva: os_live_ + 40 caracteres al azar (unos 238 bits). */
export function newApiKey() {
  const bytes = randomBytes(40)
  let body = ""
  // 248 = 62 × 4: se descartan los valores que sesgarían el reparto.
  for (const b of bytes) body += b < 248 ? BASE62[b % 62] : ""
  while (body.length < 40) {
    const b = randomBytes(1)[0]
    if (b < 248) body += BASE62[b % 62]
  }
  return API_KEY_PREFIX + body.slice(0, 40)
}

export const isApiKeyFormat = (key: string) => KEY_RE.test(key)
export const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex")
/** Lo que se muestra en la lista para reconocerla: os_live_ab12…f9e0 */
export const apiKeyHint = (key: string) => `${key.slice(0, 12)}…${key.slice(-4)}`

/** Lee "Authorization: Bearer <clave>". */
export function bearerKey(header: string | null) {
  const m = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "")
  return m ? m[1] : null
}

// ─── Webhooks ───────────────────────────────────────────────────────────────

export { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABEL, MAX_WEBHOOKS, type WebhookEvent } from "@/lib/api-events"
import type { WebhookEvent } from "@/lib/api-events"

export const wantsEvent = (events: string[], event: WebhookEvent) => events.includes("*") || events.includes(event)

/** Firma del cuerpo: X-OrdenSimple-Firma: sha256=<hex>. */
export const signWebhook = (body: string, secret: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`

export const newWebhookSecret = () => randomBytes(24).toString("hex")

const IP_HOST = /^(\d{1,3}\.){3}\d{1,3}$|^\[|:/
const LOCAL_HOST = /(^|\.)(localhost|local|internal|home|lan|localdomain|test|invalid|example)$/i

/** Dirección del webhook: solo https y un dominio público (nunca una IP ni la red interna). */
export function webhookUrlProblem(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return "Escribe la dirección completa, empezando con https://"
  }
  if (url.protocol !== "https:") return "La dirección debe empezar con https://"
  if (url.username || url.password) return "La dirección no puede llevar usuario ni contraseña."
  const host = url.hostname
  if (IP_HOST.test(host) || LOCAL_HOST.test(host) || !/\.[a-z]{2,}$/i.test(host)) return "Usa una dirección pública (un dominio, no una IP ni una red interna)."
  if (url.port && url.port !== "443") return "Usa el puerto normal de https."
  if (raw.length > 500) return "La dirección es demasiado larga."
  return null
}

/** IP privada, local o reservada: un webhook nunca puede apuntar a la red interna. */
export function isPrivateIp(ip: string) {
  if (isIPv4(ip)) return BLOCKED_V4.check(ip, "ipv4")
  // IPv6: solo se permite el rango público (2000::/3), sin los reservados. Así quedan fuera también las formas
  // que llevan una IPv4 adentro (::ffff:…, 64:ff9b::…, 2002::…), que podrían apuntar a la red interna.
  if (isIPv6(ip)) return !GLOBAL_V6.check(ip, "ipv6") || BLOCKED_V6.check(ip, "ipv6")
  return true
}

const BLOCKED_V4 = new BlockList()
for (const [net, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) BLOCKED_V4.addSubnet(net, bits, "ipv4")
const GLOBAL_V6 = new BlockList()
GLOBAL_V6.addSubnet("2000::", 3, "ipv6")
const BLOCKED_V6 = new BlockList()
for (const [net, bits] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) BLOCKED_V6.addSubnet(net, bits, "ipv6")

// ─── Paginación y filtros ───────────────────────────────────────────────────

export type ListQuery = { page: number; limit: number; since: Date | null }

/** page (desde 1), limit (1 a 200, 50 por defecto) y updated_since (ISO 8601). */
export function parseListQuery(params: URLSearchParams): ListQuery | { error: string } {
  const page = params.has("page") ? Number(params.get("page")) : 1
  const limit = params.has("limit") ? Number(params.get("limit")) : 50
  if (!Number.isInteger(page) || page < 1 || page > 100_000) return { error: "page debe ser un número entero desde 1." }
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return { error: "limit debe ser un número entero entre 1 y 200." }
  const raw = params.get("updated_since")
  let since: Date | null = null
  if (raw) {
    since = new Date(raw)
    if (Number.isNaN(since.getTime()) || !/^\d{4}-\d{2}-\d{2}/.test(raw)) return { error: "updated_since debe ser una fecha ISO 8601 (ej.: 2026-11-25T12:00:00Z)." }
  }
  return { page, limit, since }
}

export const pageMeta = (q: ListQuery, total: number) => ({
  page: q.page,
  limit: q.limit,
  total,
  next_page: q.page * q.limit < total ? q.page + 1 : null,
})

// ─── Identificadores y estados ──────────────────────────────────────────────

/**
 * Las órdenes de la API son las ventas con cliente (ven_) y las cotizaciones (cot_). Una cotización vendida
 * aparece como completada y su venta no se repite. Los clientes son cli_<id>; una cotización hecha a alguien
 * que no está en Clientes usa clc_<id de la cotización>.
 */
export const ID = {
  customer: (id: string) => `cli_${id}`,
  quoteCustomer: (quoteId: string) => `clc_${quoteId}`,
  sale: (id: string) => `ven_${id}`,
  quote: (id: string) => `cot_${id}`,
}

const RAW_ID = /^[a-z0-9]{20,40}$/
export function parseId(id: string): { kind: "cli" | "clc" | "ven" | "cot" | "prd"; raw: string } | null {
  const m = /^(cli|clc|ven|cot|prd)_(.+)$/.exec(id)
  if (!m || !RAW_ID.test(m[2])) return null
  return { kind: m[1] as "cli" | "clc" | "ven" | "cot" | "prd", raw: m[2] }
}

export const ORDER_STATES = ["pendiente", "en_proceso", "completada", "cancelada"] as const
export type OrderState = (typeof ORDER_STATES)[number]

export const QUOTE_STATE: Record<"PENDING" | "ACCEPTED" | "REJECTED" | "SOLD", OrderState> = {
  PENDING: "pendiente",
  ACCEPTED: "en_proceso",
  REJECTED: "cancelada",
  SOLD: "completada",
}
/** Estados de cotización que corresponden a un estado de la API. */
export const quoteStatusesFor = (state: OrderState) => (Object.keys(QUOTE_STATE) as (keyof typeof QUOTE_STATE)[]).filter((k) => QUOTE_STATE[k] === state)

export const API_PLAN: Record<"FREE" | "PRO" | "BUSINESS", "basico" | "pro" | "empresa"> = { FREE: "basico", PRO: "pro", BUSINESS: "empresa" }

/** Número visible de una venta (no tienen correlativo): V- y el final del id. */
export const saleNumber = (id: string) => `V-${id.slice(-6).toUpperCase()}`
export const quoteNumberLabel = (n: number) => `COT-${n}`

export const apiError = (codigo: string, mensaje: string) => ({ error: { codigo, mensaje } })
