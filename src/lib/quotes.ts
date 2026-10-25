// Cotizaciones: lo que comparten el panel, la página pública y el servidor.

export type QuoteStatusValue = "PENDING" | "ACCEPTED" | "REJECTED" | "SOLD"
/** El estado que se muestra: una pendiente cuya fecha pasó, está vencida. */
export type QuoteState = QuoteStatusValue | "EXPIRED"

export type QuoteItem = { productId: string | null; description: string; quantity: number; unitPrice: number }

export function quoteState(status: QuoteStatusValue, validUntil: Date | string, now = new Date()): QuoteState {
  return status === "PENDING" && new Date(validUntil).getTime() < now.getTime() ? "EXPIRED" : status
}

export const QUOTE_STATE_LABEL: Record<QuoteState, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  SOLD: "Vendida",
  EXPIRED: "Vencida",
}

/** Colores de cada estado (mismas clases en el panel y en la página del cliente). */
export const QUOTE_STATE_CLASS: Record<QuoteState, string> = {
  PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  ACCEPTED: "bg-success/15 text-success",
  REJECTED: "bg-destructive/10 text-destructive",
  SOLD: "bg-primary/10 text-primary",
  EXPIRED: "bg-muted text-muted-foreground",
}

export const quotePath = (token: string) => `/cotizacion/${token}`

/** Número con ceros: Cotización N.º 0007. */
export const quoteNumber = (n: number) => String(n).padStart(4, "0")

/** Mensaje para enviar la cotización al cliente por WhatsApp. */
export function quoteWhatsappText(d: { businessName: string; customerName: string; number: number; total: string; validUntil: string; url: string }) {
  const first = d.customerName.split(" ")[0] || d.customerName
  return [
    `¡Hola, ${first}! 👋 Te escribimos de *${d.businessName}*.`,
    "",
    `📄 Te enviamos la *cotización n.º ${quoteNumber(d.number)}* por *${d.total}*.`,
    `Puedes revisarla, descargarla y aceptarla aquí 👇`,
    d.url,
    "",
    `Es válida hasta el ${d.validUntil}. Cualquier duda, nos escribes por aquí. 🙌`,
  ].join("\n")
}

/** Neto e impuesto contenidos en un total que ya incluye el impuesto. */
export function grossBreakdown(total: number, rate: number) {
  const net = Math.round(total / (1 + rate))
  return { net, tax: total - net }
}
