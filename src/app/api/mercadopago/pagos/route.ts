import { syncPayment } from "@/server/mp-marketplace"

// Avisos de Mercado Pago sobre los pagos que reciben los negocios (cobros online). La dirección lleva el negocio (?b=)
// y el pago se consulta siempre a Mercado Pago con la cuenta de ese negocio: un aviso falso no cambia nada.
export async function POST(request: Request) {
  const url = new URL(request.url)
  const businessId = url.searchParams.get("b") ?? ""
  const body = (await request.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } }
  const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? ""
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "")
  if (type !== "payment" || !/^\d{1,20}$/.test(id) || !/^[\w-]{10,40}$/.test(businessId)) return new Response("ok")
  try {
    await syncPayment(businessId, id)
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_CONNECTED") return new Response("ok")
    // Mercado Pago reintenta si respondemos con error.
    console.error("[mercadopago] aviso de pago no procesado", error)
    return new Response("error", { status: 500 })
  }
  return new Response("ok")
}
