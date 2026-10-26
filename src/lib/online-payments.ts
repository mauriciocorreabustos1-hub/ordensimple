// Cobros online con Mercado Pago: lo que comparten el panel, las páginas públicas y el servidor.

import type { PaymentMethod } from "@/generated/prisma/enums"

/** Comisión de OrdenSimple sobre cada cobro online (aparte de la de Mercado Pago). */
export const ONLINE_FEE_RATE = 0.01

export const onlineFee = (amount: number) => Math.round(amount * ONLINE_FEE_RATE)

/** Cómo quedó pagado, en los medios de pago de las ventas. */
export function saleMethodFromMp(method: string | null | undefined): PaymentMethod {
  if (method === "credit_card") return "CREDIT"
  if (method === "debit_card" || method === "prepaid_card") return "DEBIT"
  return "OTHER"
}

export function mpMethodLabel(method: string | null | undefined) {
  if (method === "credit_card") return "tarjeta de crédito"
  if (method === "debit_card") return "tarjeta de débito"
  if (method === "prepaid_card") return "tarjeta de prepago"
  if (method === "account_money") return "saldo de Mercado Pago"
  return "Mercado Pago"
}

export const paymentLinkPath = (token: string) => `/cobro/${token}`

export type OnlineStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "REFUNDED"

export const ONLINE_STATUS_LABEL: Record<OnlineStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Pagado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
  REFUNDED: "Devuelto",
}

/** Mensaje para enviar un enlace de pago por WhatsApp. */
export function paymentLinkWhatsappText(d: { businessName: string; customerName?: string | null; title: string; amount: string; url: string }) {
  const first = d.customerName?.split(" ")[0]
  return [
    `¡Hola${first ? `, ${first}` : ""}! 👋 Te escribimos de *${d.businessName}*.`,
    "",
    `💳 Aquí puedes pagar *${d.title}* por *${d.amount}*, con tarjeta o Mercado Pago 👇`,
    d.url,
    "",
    "¡Gracias! 🙌",
  ].join("\n")
}
