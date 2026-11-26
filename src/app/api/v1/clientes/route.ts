import { apiRoute, jsonResponse, listCustomers, listQuery } from "@/server/api-v1"

export const dynamic = "force-dynamic"

export const GET = apiRoute(async (a, request) => {
  const q = listQuery(request)
  return q instanceof Response ? q : jsonResponse(await listCustomers(a, q))
})
