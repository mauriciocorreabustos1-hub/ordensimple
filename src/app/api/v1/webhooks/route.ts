import { z } from "zod"
import { db } from "@/lib/db"
import { MAX_WEBHOOKS, newWebhookSecret, WEBHOOK_EVENTS } from "@/lib/api-v1"
import { apiRoute, errorResponse, jsonResponse } from "@/server/api-v1"
import { sealSecret } from "@/server/secret-box"
import { checkWebhookTarget, WEBHOOK_SECRET_PURPOSE } from "@/server/webhooks"

export const dynamic = "force-dynamic"

const hookOut = (h: { id: string; url: string; events: string[]; active: boolean; createdAt: Date }) => ({
  id: h.id,
  url: h.url,
  eventos: h.events,
  activo: h.active,
  creado_en: h.createdAt.toISOString(),
})

export const GET = apiRoute(async (a) => {
  const rows = await db.webhook.findMany({ where: { businessId: a.businessId }, orderBy: { createdAt: "asc" } })
  return jsonResponse({ data: rows.map(hookOut) })
})

const schema = z.object({
  url: z.string().max(500),
  eventos: z.array(z.enum(["*", ...WEBHOOK_EVENTS])).min(1).max(5),
  /** Opcional: si la otra app ya tiene un secreto (OrdenCRM lo genera), se usa ese. */
  secreto: z.string().min(16).max(200).regex(/^[\x21-\x7e]+$/).optional(),
})

/** Suscribirse a eventos. El secreto solo se devuelve en esta respuesta. */
export const POST = apiRoute(async (a, request) => {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return errorResponse(400, "parametro_invalido", "Envía url (https) y eventos (cliente.creado, cliente.actualizado, orden.creada, orden.actualizada o *).")
  const problem = await checkWebhookTarget(parsed.data.url)
  if (problem) return errorResponse(400, "url_invalida", problem)
  if ((await db.webhook.count({ where: { businessId: a.businessId } })) >= MAX_WEBHOOKS) {
    return errorResponse(409, "limite_alcanzado", `Máximo ${MAX_WEBHOOKS} webhooks por cuenta. Elimina uno antes.`)
  }
  const secreto = parsed.data.secreto ?? newWebhookSecret()
  const h = await db.webhook.create({
    data: { businessId: a.businessId, url: parsed.data.url.trim(), events: [...new Set(parsed.data.eventos)], secret: sealSecret(secreto, WEBHOOK_SECRET_PURPOSE) },
  })
  return jsonResponse({ data: { ...hookOut(h), secreto } }, 201)
})
