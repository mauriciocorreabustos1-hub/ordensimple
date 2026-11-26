import { apiRoute, getProduct } from "@/server/api-v1"

export const dynamic = "force-dynamic"

export const GET = apiRoute(async (a, _request, { params }: RouteContext<"/api/v1/productos/[id]">) => getProduct(a, (await params).id))
