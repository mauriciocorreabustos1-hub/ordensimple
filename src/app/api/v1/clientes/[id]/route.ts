import { apiRoute, getCustomer } from "@/server/api-v1"

export const dynamic = "force-dynamic"

export const GET = apiRoute(async (a, _request, { params }: RouteContext<"/api/v1/clientes/[id]">) => getCustomer(a, (await params).id))
