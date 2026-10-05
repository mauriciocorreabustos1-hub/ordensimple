import { getAuthorizedPayment, validWebhookSignature } from "@/lib/mercadopago"
import { syncSubscription } from "@/server/billing"

// Avisos de Mercado Pago sobre suscripciones y sus cobros mensuales.
// Se configura en Mercado Pago → Tu aplicación → Webhooks con la URL https://www.ordensimple.cl/api/mercadopago/webhook
export async function POST(request: Request) {
  const url = new URL(request.url)
  const body = (await request.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } }
  const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? ""
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "")
  if (!id) return new Response("ok")
  if (!validWebhookSignature(request.headers, id)) return new Response("firma inválida", { status: 401 })

  try {
    if (type === "subscription_preapproval" || type === "preapproval") {
      await syncSubscription(id)
    } else if (type === "subscription_authorized_payment" || type === "authorized_payment") {
      const payment = await getAuthorizedPayment(id)
      if (payment.preapproval_id) {
        const approved = payment.payment?.status === "approved"
        const at = payment.debit_date ?? payment.date_created
        await syncSubscription(payment.preapproval_id, approved && at ? { chargedAt: new Date(at) } : {})
      }
    }
  } catch (error) {
    // Mercado Pago reintenta si respondemos con error.
    console.error("[mercadopago] aviso no procesado", type, error)
    return new Response("error", { status: 500 })
  }
  return new Response("ok")
}
