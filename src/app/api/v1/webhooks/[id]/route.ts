import { db } from "@/lib/db"
import { apiRoute, errorResponse } from "@/server/api-v1"

export const dynamic = "force-dynamic"

export const DELETE = apiRoute(async (a, _request, { params }: RouteContext<"/api/v1/webhooks/[id]">) => {
  const { id } = await params
  const r = await db.webhook.deleteMany({ where: { id, businessId: a.businessId } })
  return r.count ? new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }) : errorResponse(404, "no_encontrado", `No existe el webhook ${id}.`)
})
