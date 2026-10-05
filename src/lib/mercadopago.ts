import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

// Cliente mínimo de la API de Mercado Pago (suscripciones = "preapproval").
// La clave secreta va en MERCADOPAGO_ACCESS_TOKEN y nunca sale del servidor.

const API = "https://api.mercadopago.com"

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export function mercadoPagoConfigured() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN)
}

async function mp<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new MercadoPagoError("Falta configurar Mercado Pago.", 500)
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new MercadoPagoError(String(data.message ?? data.error ?? `Error ${res.status}`), res.status)
  return data as T
}

export type Preapproval = {
  id: string
  status: "pending" | "authorized" | "paused" | "cancelled" | string
  external_reference?: string | null
  payer_email?: string | null
  init_point?: string | null
  next_payment_date?: string | null
  auto_recurring?: { transaction_amount?: number; currency_id?: string }
  summarized?: { last_charged_date?: string | null; charged_quantity?: number | null } | null
}

export function createPreapproval(input: {
  reason: string
  externalReference: string
  payerEmail: string
  amount: number
  currency: string
  backUrl: string
}) {
  return mp<Preapproval>("/preapproval", {
    method: "POST",
    body: {
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      status: "pending",
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: input.amount, currency_id: input.currency },
    },
  })
}

export function getPreapproval(id: string) {
  return mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`)
}

export function cancelPreapproval(id: string) {
  return mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: { status: "cancelled" } })
}

export type AuthorizedPayment = {
  id: number | string
  preapproval_id?: string
  status?: string
  debit_date?: string | null
  date_created?: string | null
  payment?: { status?: string } | null
}

/** Un cobro mensual de una suscripción. */
export function getAuthorizedPayment(id: string) {
  return mp<AuthorizedPayment>(`/authorized_payments/${encodeURIComponent(id)}`)
}

/**
 * Verifica la firma de una notificación (cabecera x-signature) con MERCADOPAGO_WEBHOOK_SECRET.
 * Sin clave configurada se acepta: igual nunca confiamos en el contenido, siempre se consulta a la API.
 */
export function validWebhookSignature(headers: Headers, dataId: string) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return true
  const signature = headers.get("x-signature") ?? ""
  const requestId = headers.get("x-request-id") ?? ""
  const parts = Object.fromEntries(signature.split(",").map((p) => p.trim().split("=") as [string, string]))
  if (!parts.ts || !parts.v1) return false
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`
  const expected = createHmac("sha256", secret).update(manifest).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(parts.v1)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Cuenta conectada (para revisar desde el admin que el token sea de producción y de Chile). */
export async function mercadoPagoAccount() {
  if (!mercadoPagoConfigured()) return { ok: false as const, reason: "Falta MERCADOPAGO_ACCESS_TOKEN." }
  try {
    const me = await mp<{ site_id?: string; tags?: string[] }>("/users/me")
    return { ok: true as const, site: me.site_id ?? "?", test: Boolean(me.tags?.includes("test_user")) }
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error ? error.message : "No responde." }
  }
}
