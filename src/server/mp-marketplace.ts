import "server-only"
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto"
import { db } from "@/lib/db"
import { getAppUrl } from "@/lib/app-url"
import { formatMoney } from "@/lib/currency"
import { onlineFee, saleMethodFromMp, type OnlineStatus } from "@/lib/online-payments"
import { quoteNumber } from "@/lib/quotes"
import { businessManagers, sendPush } from "@/server/push"
import { sendOrderConfirmation } from "@/server/order-email"

// Cobros online como marketplace de Mercado Pago: cada negocio conecta su cuenta (OAuth), sus clientes le pagan
// a esa cuenta y OrdenSimple recibe su comisión (marketplace_fee) en la cuenta de la aplicación.
// Claves: MERCADOPAGO_CLIENT_ID y MERCADOPAGO_CLIENT_SECRET (de la aplicación de OrdenSimple). Sin ellas, todo queda apagado.

const API = process.env.MERCADOPAGO_API_URL ?? "https://api.mercadopago.com"
const AUTH = process.env.MERCADOPAGO_AUTH_URL ?? "https://auth.mercadopago.cl"

export function onlinePaymentsAvailable() {
  return Boolean(process.env.MERCADOPAGO_CLIENT_ID && process.env.MERCADOPAGO_CLIENT_SECRET && process.env.BETTER_AUTH_SECRET)
}

export const oauthRedirectUri = () => `${getAppUrl()}/api/mercadopago/oauth`

// ─── Claves de cada negocio, cifradas ───────────────────────────────────────

function key(purpose = "mercadopago-tokens") {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("Falta BETTER_AUTH_SECRET")
  return Buffer.from(hkdfSync("sha256", secret, "ordensimple", purpose, 32))
}

export function encryptToken(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`
}

export function decryptToken(stored: string) {
  const [v, iv, tag, data] = stored.split(".")
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Clave guardada inválida")
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")
}

// ─── Conexión (OAuth) ───────────────────────────────────────────────────────

const STATE_TTL_MS = 15 * 60_000

function sign(payload: string) {
  return createHmac("sha256", key("mercadopago-oauth-state")).update(payload).digest("base64url")
}

/** Estado firmado para la vuelta de Mercado Pago: de qué negocio y persona es, y hasta cuándo vale. */
export function oauthState(businessId: string, userId: string) {
  const payload = Buffer.from(JSON.stringify({ b: businessId, u: userId, e: Date.now() + STATE_TTL_MS, n: randomBytes(8).toString("hex") })).toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function readOauthState(state: string) {
  const [payload, mac] = state.split(".")
  if (!payload || !mac) return null
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { b: string; u: string; e: number }
    return d.e > Date.now() ? { businessId: d.b, userId: d.u } : null
  } catch {
    return null
  }
}

export function authorizationUrl(state: string) {
  const qs = new URLSearchParams({ client_id: process.env.MERCADOPAGO_CLIENT_ID ?? "", response_type: "code", platform_id: "mp", state, redirect_uri: oauthRedirectUri() })
  return `${AUTH}/authorization?${qs}`
}

type TokenResponse = { access_token: string; refresh_token?: string; public_key?: string; user_id: number | string; expires_in?: number; live_mode?: boolean }

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.MERCADOPAGO_CLIENT_ID, client_secret: process.env.MERCADOPAGO_CLIENT_SECRET, ...body }),
    cache: "no-store",
  })
  const data = (await res.json().catch(() => ({}))) as TokenResponse & { message?: string }
  if (!res.ok || !data.access_token) throw new Error(data.message ?? `Mercado Pago respondió ${res.status}`)
  return data
}

function accountData(t: TokenResponse) {
  return {
    mpUserId: String(t.user_id),
    accessToken: encryptToken(t.access_token),
    refreshToken: t.refresh_token ? encryptToken(t.refresh_token) : null,
    publicKey: t.public_key ?? null,
    expiresAt: new Date(Date.now() + (t.expires_in ?? 15_552_000) * 1000),
    liveMode: t.live_mode ?? true,
  }
}

/** Cambia el código de la vuelta por las claves del negocio y las guarda cifradas. */
export async function connectAccount(businessId: string, userId: string, code: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: oauthRedirectUri() })
  const data = accountData(t)
  await db.mercadoPagoAccount.upsert({ where: { businessId }, update: { ...data, connectedById: userId }, create: { businessId, ...data, connectedById: userId } })
}

/** Clave vigente del negocio (la renueva si vence en menos de una semana). Null si no conectó su cuenta. */
async function sellerToken(businessId: string) {
  const account = await db.mercadoPagoAccount.findUnique({ where: { businessId } })
  if (!account) return null
  if (account.expiresAt.getTime() - Date.now() > 7 * 86_400_000 || !account.refreshToken) return decryptToken(account.accessToken)
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptToken(account.refreshToken) })
  await db.mercadoPagoAccount.update({ where: { businessId }, data: accountData(t) })
  return t.access_token
}

async function sellerApi<T>(businessId: string, path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}) {
  const token = await sellerToken(businessId)
  if (!token) throw new Error("NOT_CONNECTED")
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const data = (await res.json().catch(() => ({}))) as T & { message?: string }
  if (!res.ok) throw new Error(data.message ?? `Mercado Pago respondió ${res.status}`)
  return data
}

// ─── Cobrar ─────────────────────────────────────────────────────────────────

/**
 * Crea el cobro en Mercado Pago a nombre del negocio, con la comisión de OrdenSimple, y devuelve la página de pago.
 */
export async function checkoutUrl(payment: { id: string; businessId: string; description: string; amount: number; fee: number }, opts: { currency: string; payerName?: string | null }) {
  const app = getAppUrl()
  const ret = `${app}/api/mercadopago/vuelta?p=${payment.id}`
  const pref = await sellerApi<{ id: string; init_point: string }>(payment.businessId, "/checkout/preferences", {
    method: "POST",
    idempotencyKey: payment.id,
    body: {
      items: [{ id: payment.id, title: payment.description.slice(0, 120), quantity: 1, unit_price: payment.amount, currency_id: opts.currency }],
      marketplace_fee: payment.fee,
      external_reference: payment.id,
      notification_url: `${app}/api/mercadopago/pagos?b=${payment.businessId}`,
      back_urls: { success: ret, pending: ret, failure: ret },
      auto_return: "approved",
      statement_descriptor: "ORDENSIMPLE",
      // El pago dividido funciona con tarjetas y saldo de Mercado Pago (no con transferencias ni pagos en efectivo).
      payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "bank_transfer" }] },
      ...(opts.payerName ? { payer: { name: opts.payerName.slice(0, 60) } } : {}),
    },
  })
  await db.onlinePayment.update({ where: { id: payment.id }, data: { preferenceId: pref.id } })
  return pref.init_point
}

type MpPayment = {
  id: number | string
  status: string
  external_reference?: string | null
  transaction_amount?: number
  currency_id?: string
  payment_type_id?: string
  date_approved?: string | null
  /** Comisión del marketplace cobrada en este pago (según la versión de la API viene aquí o en fee_details). */
  marketplace_fee?: number | null
  fee_details?: { type?: string; amount?: number }[] | null
}

/** Comisión de OrdenSimple que Mercado Pago dice haber cobrado en el pago. */
function collectedFee(mp: MpPayment) {
  const fromDetails = (mp.fee_details ?? []).filter((f) => f.type === "application_fee").reduce((s, f) => s + Number(f.amount ?? 0), 0)
  return Math.max(Number(mp.marketplace_fee ?? 0), fromDetails)
}

function statusFrom(mp: string): OnlineStatus {
  if (mp === "approved") return "APPROVED"
  if (mp === "rejected") return "REJECTED"
  if (mp === "cancelled") return "CANCELLED"
  if (mp === "refunded" || mp === "charged_back") return "REFUNDED"
  return "PENDING"
}

/**
 * Consulta el pago en Mercado Pago (nunca se confía en lo que llega en el aviso) y lo aplica:
 * pedido o cotización marcados como pagados, o el enlace pagado con su venta. Se puede llamar varias veces.
 */
export async function syncPayment(businessId: string, mpPaymentId: string) {
  const mp = await sellerApi<MpPayment>(businessId, `/v1/payments/${encodeURIComponent(mpPaymentId)}`)
  const ref = mp.external_reference
  if (!ref) return null
  const payment = await db.onlinePayment.findFirst({ where: { id: ref, businessId } })
  if (!payment) return null
  const status = statusFrom(mp.status)
  // Un pago ya aprobado solo lo puede cambiar ese mismo pago de Mercado Pago (por ejemplo, si se devuelve).
  if (payment.status === "APPROVED" && payment.mpPaymentId && payment.mpPaymentId !== String(mp.id)) return payment
  if (status === "APPROVED") {
    // Tiene que ser el cobro que armó OrdenSimple: mismo monto, misma moneda y con la comisión incluida.
    const business = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { currency: true } })
    const sameAmount = Math.round(Number(mp.transaction_amount ?? 0)) === payment.amount
    const sameCurrency = (mp.currency_id ?? "").toUpperCase() === business.currency.toUpperCase()
    const feePaid = payment.fee <= 0 || collectedFee(mp) >= payment.fee
    if (!sameAmount || !sameCurrency || !feePaid) {
      console.error("[mercadopago] pago que no calza con el cobro", payment.id, { sameAmount, sameCurrency, feePaid })
      return payment
    }
  }
  if (status === "PENDING" || status === payment.status) return payment

  const firstApproval = status === "APPROVED" && payment.status !== "APPROVED"
  const updated = await db.onlinePayment.updateMany({
    // Ya aprobado: solo ese mismo pago de Mercado Pago lo cambia (aunque dos avisos lleguen a la vez). Si no, vale un nuevo intento.
    where: { id: payment.id, status: { not: status }, OR: [{ status: { not: "APPROVED" } }, { mpPaymentId: String(mp.id) }] },
    data: { status, mpPaymentId: String(mp.id), method: mp.payment_type_id ?? null, ...(status === "APPROVED" ? { paidAt: mp.date_approved ? new Date(mp.date_approved) : new Date() } : {}) },
  })
  if (updated.count !== 1 || !firstApproval) return payment

  const business = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { currency: true } })
  const money = formatMoney(payment.amount, business.currency)
  let title = `💳 Pago recibido: ${money}`
  let url = "/dashboard/cobros"
  if (payment.kind === "QUOTE" && payment.quoteId) {
    const q = await db.quote.findUnique({ where: { id: payment.quoteId }, select: { number: true, customerName: true, status: true } })
    if (q?.status === "PENDING") await db.quote.update({ where: { id: payment.quoteId }, data: { status: "ACCEPTED", respondedAt: new Date() } })
    if (q) title = `💳 Cotización n.º ${quoteNumber(q.number)} pagada: ${money} (${q.customerName})`
    url = "/dashboard/cotizaciones"
  } else if (payment.kind === "WEB_ORDER" && payment.webOrderId) {
    const o = await db.webOrder.findUnique({ where: { id: payment.webOrderId }, select: { customerName: true } })
    if (o) title = `💳 Pedido web pagado: ${money} (${o.customerName})`
    await sendOrderConfirmation(payment.webOrderId, true).catch((e) => console.error("[pedido] correo", e))
    url = "/dashboard/pedidos"
  } else if (payment.kind === "LINK" && payment.linkId) {
    await paidLink(payment.linkId, businessId, payment.amount, saleMethodFromMp(mp.payment_type_id))
    const l = await db.paymentLink.findUnique({ where: { id: payment.linkId }, select: { title: true } })
    if (l) title = `💳 Pagaron ${l.title}: ${money}`
  }
  await sendPush(await businessManagers(businessId), { title, body: "Con Mercado Pago. Ya está en tu cuenta.", url, tag: `pago-${payment.id}` }).catch(() => {})
  return payment
}

/** Enlace pagado: queda como venta del día (una sola vez). */
async function paidLink(linkId: string, businessId: string, amount: number, method: ReturnType<typeof saleMethodFromMp>) {
  await db.$transaction(async (tx) => {
    // Un enlace de fiado anulado (por otro con el saldo nuevo) pudo pagarse igual en una pestaña abierta: el dinero
    // llegó, así que también queda como abono.
    const link = await tx.paymentLink.findFirst({
      where: { id: linkId, businessId, OR: [{ status: "ACTIVE" }, { status: "CANCELLED", forDebt: true }] },
    })
    if (!link) return
    // Cobro de fiado: es un abono a la cuenta del cliente (la venta ya se registró cuando se fió).
    if (link.forDebt && link.customerId) {
      await tx.customerPayment.create({
        data: { businessId, customerId: link.customerId, amount, paymentMethod: method, note: "Pago online con Mercado Pago", createdById: link.createdById },
      })
      const r = await tx.paymentLink.updateMany({ where: { id: linkId, status: { in: ["ACTIVE", "CANCELLED"] } }, data: { status: "PAID", paidAt: new Date() } })
      if (r.count !== 1) throw new Error("LINK_PAID")
      return
    }
    const sale = await tx.sale.create({
      data: {
        businessId,
        total: amount,
        paymentMethod: method,
        isQuick: true,
        note: `Pago online: ${link.title}`.slice(0, 200),
        createdById: link.createdById,
        items: { create: { description: link.title.slice(0, 120), quantity: 1, unitPrice: amount, subtotal: amount } },
      },
      select: { id: true },
    })
    const r = await tx.paymentLink.updateMany({ where: { id: linkId, status: "ACTIVE" }, data: { status: "PAID", paidAt: new Date(), saleId: sale.id } })
    if (r.count !== 1) throw new Error("LINK_PAID")
  }).catch((error) => {
    if (!(error instanceof Error && error.message === "LINK_PAID")) throw error
  })
}

/** Nuevo cobro pendiente (con la comisión de OrdenSimple calculada). */
export function newPayment(data: { businessId: string; kind: "WEB_ORDER" | "QUOTE" | "LINK"; description: string; amount: number; webOrderId?: string; quoteId?: string; linkId?: string }) {
  return db.onlinePayment.create({ data: { ...data, fee: onlineFee(data.amount) }, select: { id: true, businessId: true, description: true, amount: true, fee: true } })
}

/** Para las páginas públicas: si ya se pagó (y cómo) y si el negocio puede cobrar online. */
export async function onlinePayInfo(businessId: string, where: { webOrderId?: string; quoteId?: string; linkId?: string }) {
  const [paid, account] = await Promise.all([
    db.onlinePayment.findFirst({ where: { ...where, businessId, status: "APPROVED" }, select: { method: true, paidAt: true } }),
    onlinePaymentsAvailable() ? db.mercadoPagoAccount.findUnique({ where: { businessId }, select: { storeEnabled: true } }) : null,
  ])
  return { paid, connected: Boolean(account), storeEnabled: Boolean(account?.storeEnabled) }
}

/** ¿El negocio tiene Mercado Pago conectado para cobrar online? */
export async function canCollectOnline(businessId: string) {
  if (!onlinePaymentsAvailable()) return false
  return Boolean(await db.mercadoPagoAccount.findUnique({ where: { businessId }, select: { id: true } }))
}

/** Qué se paga online en la tienda (lo fija el dueño): todo, solo los despachos, o nada (null: se paga al retirar o recibir). */
export async function storePayRule(businessId: string): Promise<"ALL" | "DELIVERY" | null> {
  if (!onlinePaymentsAvailable()) return null
  const account = await db.mercadoPagoAccount.findUnique({ where: { businessId }, select: { storeEnabled: true, storePayRule: true } })
  return account?.storeEnabled ? account.storePayRule : null
}

/** ¿Este pedido se paga online al hacerlo? (las mesas de la carta QR pagan en el local) */
export const mustPayOnline = (rule: "ALL" | "DELIVERY" | null, o: { delivery: boolean; table?: string | null }) =>
  !o.table && (rule === "ALL" || (rule === "DELIVERY" && o.delivery))
