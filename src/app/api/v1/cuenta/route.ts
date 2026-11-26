import { apiRoute, getAccount, jsonResponse } from "@/server/api-v1"

export const dynamic = "force-dynamic"

/** Datos del negocio dueño de la clave (sirve para validar la clave al vincular). */
export const GET = apiRoute(async (a) => jsonResponse({ data: await getAccount(a) }))
