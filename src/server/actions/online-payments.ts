"use server"

import { randomBytes } from "node:crypto"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { quoteNumber, quoteState } from "@/lib/quotes"
import { idSchema, optionalText, positiveMoney } from "@/lib/validations"
import { checkoutUrl, newPayment, onlinePaymentsAvailable } from "@/server/mp-marketplace"
import { allowAttempt } from "@/server/rate-limit"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

const TOKEN_RE = /^[\w-]{16,64}$/
const UNAVAILABLE = "El pago online no está disponible en este momento. Escríbele al negocio."

async function rateLimited() {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip"
  return !(await allowAttempt(`pago-online:${ip}`, 20, 60 * 60_000))
}

async function connected(businessId: string) {
  return onlinePaymentsAvailable() ? db.mercadoPagoAccount.findUnique({ where: { businessId }, select: { storeEnabled: true } }) : null
}

async function alreadyPaid(where: { webOrderId?: string; quoteId?: string; linkId?: string }) {
  return Boolean(await db.onlinePayment.findFirst({ where: { ...where, status: "APPROVED" }, select: { id: true } }))
}

// ─── Lo que inicia el cliente (sin cuenta) ──────────────────────────────────

/** Pagar un pedido de la tienda online (desde su enlace de seguimiento o al hacerlo). */
export async function payWebOrder(track: string): Promise<ActionResult<{ url: string }>> {
  if (!TOKEN_RE.test(track)) return { ok: false, message: "Pedido no encontrado." }
  try {
    if (await rateLimited()) return { ok: false, message: "Demasiados intentos. Espera un rato." }
    const order = await db.webOrder.findUnique({
      where: { trackToken: track },
      select: { id: true, businessId: true, total: true, status: true, customerName: true, business: { select: { name: true, currency: true } } },
    })
    if (!order || order.status === "CANCELLED") return { ok: false, message: "Este pedido ya no se puede pagar." }
    const account = await connected(order.businessId)
    if (!account?.storeEnabled) return { ok: false, message: UNAVAILABLE }
    if (await alreadyPaid({ webOrderId: order.id })) return { ok: false, message: "Este pedido ya está pagado." }
    const payment = await newPayment({ businessId: order.businessId, kind: "WEB_ORDER", webOrderId: order.id, amount: order.total, description: `Pedido n.º ${order.id.slice(-5).toUpperCase()} · ${order.business.name}` })
    return { ok: true, data: { url: await checkoutUrl(payment, { currency: order.business.currency, payerName: order.customerName }) } }
  } catch (error) {
    return toActionError(error)
  }
}

/** Pagar una cotización (aceptarla y pagarla de una vez). */
export async function payQuote(token: string): Promise<ActionResult<{ url: string }>> {
  if (!TOKEN_RE.test(token)) return { ok: false, message: "Cotización no encontrada." }
  try {
    if (await rateLimited()) return { ok: false, message: "Demasiados intentos. Espera un rato." }
    const q = await db.quote.findUnique({
      where: { token },
      select: { id: true, businessId: true, number: true, total: true, status: true, validUntil: true, customerName: true, business: { select: { name: true, currency: true } } },
    })
    if (!q) return { ok: false, message: "Cotización no encontrada." }
    const state = quoteState(q.status, q.validUntil)
    if (state !== "PENDING" && state !== "ACCEPTED") return { ok: false, message: "Esta cotización ya no se puede pagar. Escríbele al negocio." }
    if (!(await connected(q.businessId))) return { ok: false, message: UNAVAILABLE }
    if (await alreadyPaid({ quoteId: q.id })) return { ok: false, message: "Esta cotización ya está pagada." }
    const payment = await newPayment({ businessId: q.businessId, kind: "QUOTE", quoteId: q.id, amount: q.total, description: `Cotización n.º ${quoteNumber(q.number)} · ${q.business.name}` })
    return { ok: true, data: { url: await checkoutUrl(payment, { currency: q.business.currency, payerName: q.customerName }) } }
  } catch (error) {
    return toActionError(error)
  }
}

/** Pagar un enlace de pago. */
export async function payLink(token: string): Promise<ActionResult<{ url: string }>> {
  if (!TOKEN_RE.test(token)) return { ok: false, message: "Enlace no encontrado." }
  try {
    if (await rateLimited()) return { ok: false, message: "Demasiados intentos. Espera un rato." }
    const link = await db.paymentLink.findUnique({ where: { token }, select: { id: true, businessId: true, title: true, amount: true, status: true, customerName: true, business: { select: { name: true, currency: true } } } })
    if (!link || link.status !== "ACTIVE") return { ok: false, message: "Este enlace ya no está disponible." }
    if (!(await connected(link.businessId))) return { ok: false, message: UNAVAILABLE }
    const payment = await newPayment({ businessId: link.businessId, kind: "LINK", linkId: link.id, amount: link.amount, description: `${link.title} · ${link.business.name}` })
    return { ok: true, data: { url: await checkoutUrl(payment, { currency: link.business.currency, payerName: link.customerName }) } }
  } catch (error) {
    return toActionError(error)
  }
}

// ─── Lo que hace el negocio ─────────────────────────────────────────────────

function revalidate() {
  revalidatePath("/dashboard/cobros")
}

export async function disconnectMercadoPago(): Promise<ActionResult> {
  const ctx = await requireBusiness()
  try {
    assertCan(ctx, "settings:manage")
    await db.mercadoPagoAccount.deleteMany({ where: { businessId: ctx.businessId } })
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Mercado Pago desconectado: tus clientes ya no pueden pagar online" }
}

export async function setStorePayments(enabled: boolean): Promise<ActionResult> {
  const ctx = await requireBusiness()
  try {
    assertCan(ctx, "settings:manage")
    const r = await db.mercadoPagoAccount.updateMany({ where: { businessId: ctx.businessId }, data: { storeEnabled: enabled } })
    if (r.count !== 1) return { ok: false, message: "Primero conecta tu cuenta de Mercado Pago." }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: enabled ? "Tus clientes pueden pagar online en la tienda" : "La tienda ya no ofrece pagar online" }
}

const linkSchema = z.object({
  title: z.string().trim().min(2, "Escribe qué estás cobrando").max(80, "Máximo 80 caracteres"),
  amount: positiveMoney,
  customerName: optionalText(80),
  customerPhone: optionalText(30),
})
export type PaymentLinkInput = z.input<typeof linkSchema>

export async function createPaymentLink(input: PaymentLinkInput): Promise<ActionResult<{ token: string }>> {
  const ctx = await requireBusiness()
  const parsed = linkSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  try {
    assertCan(ctx, "sales:create")
    if (!(await connected(ctx.businessId))) return { ok: false, message: "Primero conecta tu cuenta de Mercado Pago." }
    const link = await db.paymentLink.create({
      data: { ...parsed.data, customerName: parsed.data.customerName ?? null, customerPhone: parsed.data.customerPhone ?? null, businessId: ctx.businessId, token: randomBytes(18).toString("base64url"), createdById: ctx.user.id },
      select: { token: true },
    })
    revalidate()
    return { ok: true, message: "Enlace de pago listo", data: link }
  } catch (error) {
    return toActionError(error)
  }
}

export async function cancelPaymentLink(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Enlace no encontrado." }
  try {
    assertCan(ctx, "sales:create")
    const r = await db.paymentLink.updateMany({ where: { id, businessId: ctx.businessId, status: "ACTIVE" }, data: { status: "CANCELLED" } })
    if (r.count !== 1) return { ok: false, message: "Este enlace ya se pagó o se anuló." }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Enlace anulado" }
}
