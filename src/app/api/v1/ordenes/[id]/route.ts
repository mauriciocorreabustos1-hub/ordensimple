import { apiRoute, getOrder } from "@/server/api-v1"

export const dynamic = "force-dynamic"

export const GET = apiRoute(async (a, _request, { params }: RouteContext<"/api/v1/ordenes/[id]">) => getOrder(a, (await params).id))
