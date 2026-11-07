import "server-only"
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto"
import { getAppUrl } from "@/lib/app-url"
import { db } from "@/lib/db"

// Mercado Libre: la cuenta de vendedor de OrdenSimple, para entregar solo los códigos del Pro permanente.
// Variables de entorno (Vercel):
//   MERCADOLIBRE_CLIENT_ID, MERCADOLIBRE_CLIENT_SECRET  → de la aplicación en Mercado Libre Developers
//   MERCADOLIBRE_ITEM_IDS                               → publicaciones del Pro permanente, separadas por coma (MLC123...)
// La sesión del vendedor (tokens) cambia cada 6 horas: se guarda cifrada en la base de datos, no en variables.

const API = () => process.env.MERCADOLIBRE_API_URL ?? "https://api.mercadolibre.com"
const AUTH = () => process.env.MERCADOLIBRE_AUTH_URL ?? "https://auth.mercadolibre.cl"
/** Desde 2026, en Chile los mensajes al comprador van dirigidos al agente de mensajería de Mercado Libre. */
const AGENT_ID = () => process.env.MERCADOLIBRE_AGENT_ID ?? "3020819166"

export function mercadoLibreConfigured() {
  return Boolean(process.env.MERCADOLIBRE_CLIENT_ID && process.env.MERCADOLIBRE_CLIENT_SECRET && process.env.BETTER_AUTH_SECRET)
}

/** Publicaciones del Pro permanente (en mayúsculas). */
export function licenseItemIds() {
  return (process.env.MERCADOLIBRE_ITEM_IDS ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
}

export const mlRedirectUri = () => `${getAppUrl()}/api/mercadolibre/oauth`

// ─── Cifrado de la sesión ───────────────────────────────────────────────────

function key(purpose: string) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("Falta BETTER_AUTH_SECRET")
  return Buffer.from(hkdfSync("sha256", secret, "ordensimple", purpose, 32))
}

function seal(plain: string, purpose = "mercadolibre-tokens") {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(purpose), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`
}

function open(stored: string, purpose = "mercadolibre-tokens") {
  const [v, iv, tag, data] = stored.split(".")
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Dato cifrado inválido")
  const decipher = createDecipheriv("aes-256-gcm", key(purpose), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")
}

// ─── Conexión (OAuth con PKCE) ──────────────────────────────────────────────

const STATE_TTL_MS = 15 * 60_000

/** Enlace para autorizar la cuenta de vendedor. El estado va cifrado: quién la conecta, hasta cuándo y el verificador PKCE. */
export function mlAuthorizationUrl(adminEmail: string) {
  const verifier = randomBytes(32).toString("base64url")
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  const state = seal(JSON.stringify({ u: adminEmail.toLowerCase(), v: verifier, e: Date.now() + STATE_TTL_MS }), "mercadolibre-oauth-state")
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.MERCADOLIBRE_CLIENT_ID ?? "",
    redirect_uri: mlRedirectUri(),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  })
  return `${AUTH()}/authorization?${params}`
}

export function readMlState(state: string, adminEmail: string) {
  try {
    const d = JSON.parse(open(state, "mercadolibre-oauth-state")) as { u: string; v: string; e: number }
    return d.e > Date.now() && d.u === adminEmail.toLowerCase() ? { verifier: d.v } : null
  } catch {
    return null
  }
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number; user_id: number | string }

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API()}/oauth/token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.MERCADOLIBRE_CLIENT_ID ?? "", client_secret: process.env.MERCADOLIBRE_CLIENT_SECRET ?? "", ...body }),
    cache: "no-store",
  })
  const data = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { message?: string; error?: string }
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new MlApiError(res.status, data.message || data.error || "No se pudo obtener la sesión de Mercado Libre")
  }
  return data as TokenResponse
}

const expiresAt = (t: TokenResponse) => new Date(Date.now() + Math.max(60, t.expires_in - 120) * 1000)

export async function connectMercadoLibre(code: string, verifier: string, by: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: mlRedirectUri(), code_verifier: verifier })
  const me = await fetch(`${API()}/users/me`, { headers: { Authorization: `Bearer ${t.access_token}` }, cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ nickname?: string }>) : {}))
    .catch(() => ({}) as { nickname?: string })
  const data = {
    sellerId: String(t.user_id),
    nickname: (me as { nickname?: string }).nickname ?? null,
    accessToken: seal(t.access_token),
    refreshToken: seal(t.refresh_token),
    expiresAt: expiresAt(t),
    connectedBy: by,
  }
  await db.mercadoLibreAccount.upsert({ where: { id: "principal" }, create: { id: "principal", ...data }, update: data })
  return data
}

export async function mercadoLibreAccount() {
  return db.mercadoLibreAccount.findUnique({ where: { id: "principal" }, select: { sellerId: true, nickname: true, expiresAt: true, connectedBy: true, updatedAt: true } })
}

/**
 * Token vigente. La renovación es de un solo uso: se hace con un candado en la base de datos para que dos avisos
 * simultáneos no la gasten dos veces (la segunda dejaría la cuenta desconectada).
 */
async function accessToken(force = false) {
  const account = await db.mercadoLibreAccount.findUnique({ where: { id: "principal" } })
  if (!account) throw new MlApiError(0, "La cuenta de Mercado Libre no está conectada")
  if (!force && account.expiresAt.getTime() - Date.now() > 10 * 60_000) return { token: open(account.accessToken), sellerId: account.sellerId }
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('mercadolibre-token'))`
      const fresh = await tx.mercadoLibreAccount.findUniqueOrThrow({ where: { id: "principal" } })
      // Otro aviso ya la renovó mientras esperábamos el candado.
      if (fresh.updatedAt > account.updatedAt && fresh.expiresAt.getTime() - Date.now() > 10 * 60_000) return { token: open(fresh.accessToken), sellerId: fresh.sellerId }
      const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: open(fresh.refreshToken) })
      await tx.mercadoLibreAccount.update({ where: { id: "principal" }, data: { accessToken: seal(t.access_token), refreshToken: seal(t.refresh_token), expiresAt: expiresAt(t) } })
      return { token: t.access_token, sellerId: fresh.sellerId }
    },
    { timeout: 20_000, maxWait: 20_000 },
  )
}

export class MlApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message)
  }
}

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}, retried = false): Promise<T> {
  const { token } = await accessToken()
  const res = await fetch(`${API()}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : null
  if (res.status === 401 && !retried) {
    await accessToken(true)
    return api<T>(path, init, true)
  }
  if (!res.ok) {
    const d = (data ?? {}) as { message?: string; error?: string; cause?: unknown }
    throw new MlApiError(res.status, `${res.status} ${d.message || d.error || "Error de Mercado Libre"}`, data)
  }
  return data as T
}

// ─── Lo que usa la entrega de códigos ───────────────────────────────────────

export type MlOrderData = {
  id: number | string
  status: string
  pack_id?: number | string | null
  seller?: { id: number | string }
  buyer?: { id: number | string; nickname?: string }
  order_items: { item: { id: string }; quantity: number }[]
  payments?: { status: string }[]
  mediations?: unknown[]
}

/** Lo que la entrega necesita de Mercado Libre (en las pruebas se reemplaza por uno simulado). */
export type MlClient = {
  sellerId: () => Promise<string>
  getOrder: (orderId: string) => Promise<MlOrderData>
  sendMessage: (packId: string, text: string) => Promise<void>
}

type SentMessage = { status?: string; message_moderation?: { status?: string; reason?: string | null } }

function checkSent(m: SentMessage | null) {
  if (m?.status === "moderated" || m?.status === "rejected" || m?.message_moderation?.status === "rejected") {
    throw new MlApiError(422, `Mercado Libre rechazó el mensaje${m.message_moderation?.reason ? ` (${m.message_moderation.reason})` : ""}`)
  }
}

export const mercadoLibre: MlClient = {
  sellerId: async () => (await accessToken()).sellerId,
  getOrder: (orderId) => api<MlOrderData>(`/orders/${encodeURIComponent(orderId)}`),
  /**
   * El vendedor no puede escribir primero libremente: se usa el motivo "Otro" (texto libre, 1 mensaje). Si la venta
   * no admite motivos (caso exceptuado o conversación ya abierta), se envía por la mensajería normal.
   */
  sendMessage: async (packId, text) => {
    const pack = encodeURIComponent(packId)
    try {
      checkSent(await api<SentMessage>(`/messages/action_guide/packs/${pack}/option?tag=post_sale`, { method: "POST", body: { option_id: "OTHER", text } }))
      return
    } catch (first) {
      // Mensaje rechazado por moderación: no tiene sentido reenviarlo por la otra vía.
      if (first instanceof MlApiError && first.status === 422) throw first
      const seller = (await accessToken()).sellerId
      try {
        checkSent(
          await api<SentMessage>(`/messages/packs/${pack}/sellers/${encodeURIComponent(seller)}?tag=post_sale`, {
            method: "POST",
            body: { from: { user_id: seller }, to: { user_id: AGENT_ID() }, text },
          }),
        )
      } catch (second) {
        const a = first instanceof Error ? first.message : String(first)
        const b = second instanceof Error ? second.message : String(second)
        throw new MlApiError(second instanceof MlApiError ? second.status : 0, `Motivo "Otro": ${a} · Mensajería: ${b}`)
      }
    }
  },
}
