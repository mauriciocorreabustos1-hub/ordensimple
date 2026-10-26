import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { paymentLinkPath } from "@/lib/online-payments"
import { quotePath } from "@/lib/quotes"
import { orderTrackPath } from "@/lib/store"
import { syncPayment } from "@/server/mp-marketplace"

// El cliente vuelve de pagar en Mercado Pago: se revisa el pago (consultando a Mercado Pago) y vuelve a la página
// del pedido, la cotización o el enlace, con el resultado.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get("p") ?? ""
  const mpPaymentId = url.searchParams.get("payment_id") ?? url.searchParams.get("collection_id")
  const payment = /^[\w-]{10,40}$/.test(id) ? await db.onlinePayment.findUnique({ where: { id } }) : null
  if (!payment) redirect("/")
  if (mpPaymentId && /^\d{1,20}$/.test(mpPaymentId)) {
    await syncPayment(payment.businessId, mpPaymentId).catch((error) => console.error("[mercadopago] vuelta", error))
  }
  const fresh = await db.onlinePayment.findUniqueOrThrow({ where: { id }, select: { status: true } })
  const result = fresh.status === "APPROVED" ? "ok" : url.searchParams.get("status") === "pending" || url.searchParams.get("collection_status") === "pending" ? "pendiente" : "error"

  let target = "/"
  if (payment.kind === "WEB_ORDER" && payment.webOrderId) {
    const o = await db.webOrder.findUnique({ where: { id: payment.webOrderId }, select: { trackToken: true } })
    if (o) target = orderTrackPath(o.trackToken)
  } else if (payment.kind === "QUOTE" && payment.quoteId) {
    const q = await db.quote.findUnique({ where: { id: payment.quoteId }, select: { token: true } })
    if (q) target = quotePath(q.token)
  } else if (payment.kind === "LINK" && payment.linkId) {
    const l = await db.paymentLink.findUnique({ where: { id: payment.linkId }, select: { token: true } })
    if (l) target = paymentLinkPath(l.token)
  }
  redirect(`${target}?pago=${result}`)
}
