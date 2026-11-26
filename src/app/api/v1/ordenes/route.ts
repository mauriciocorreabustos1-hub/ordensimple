import { apiRoute, listOrders, listQuery } from "@/server/api-v1"

export const dynamic = "force-dynamic"

/** Ventas con cliente y cotizaciones. Filtros: updated_since, estado y cliente_id. */
export const GET = apiRoute(async (a, request) => {
  const q = listQuery(request)
  return q instanceof Response ? q : listOrders(a, q, new URL(request.url).searchParams)
})
