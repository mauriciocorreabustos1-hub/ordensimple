import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { syncSubscription } from "@/server/billing"
import { requireBusiness } from "@/server/session"

// Mercado Pago devuelve aquí después del pago (?preapproval_id=...). Se consulta el estado real y se vuelve al plan.
export async function GET(request: Request) {
  const ctx = await requireBusiness()
  const url = new URL(request.url)
  const id = url.searchParams.get("preapproval_id") ?? ""
  let result = "pendiente"
  if (id) {
    const sub = await db.subscription.findFirst({ where: { externalId: id, businessId: ctx.businessId } })
    if (sub) {
      const updated = await syncSubscription(id).catch((e) => {
        console.error("[billing] no se pudo revisar la suscripción", e)
        return null
      })
      if (updated?.status === "authorized") result = "ok"
    }
  }
  return NextResponse.redirect(new URL(`/dashboard/configuracion?suscripcion=${result}#plan`, url))
}
