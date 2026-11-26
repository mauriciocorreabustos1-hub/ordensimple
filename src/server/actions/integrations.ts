"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { apiKeyHint, hashApiKey, MAX_WEBHOOKS, newApiKey, newWebhookSecret, WEBHOOK_EVENTS } from "@/lib/api-v1"
import { idSchema } from "@/lib/validations"
import { assertCan, requireBusiness } from "@/server/session"
import { sealSecret, openSecret } from "@/server/secret-box"
import { checkWebhookTarget, deliverWebhook, WEBHOOK_SECRET_PURPOSE } from "@/server/webhooks"
import { toActionError, type ActionResult } from "@/server/actions/result"

// Configuración, sección Integraciones: claves de la API y avisos (webhooks). Solo dueños y administradores.

const MAX_KEYS = 10
const PATH = "/dashboard/configuracion"

export async function createApiKey(name: string): Promise<ActionResult<{ key: string }>> {
  const ctx = await requireBusiness()
  const n = z.string().trim().min(2).max(40).safeParse(name)
  if (!n.success) return { ok: false, message: "Ponle un nombre de 2 a 40 letras (por ejemplo, OrdenCRM)." }
  try {
    assertCan(ctx, "settings:manage")
    if ((await db.apiKey.count({ where: { businessId: ctx.businessId, revokedAt: null } })) >= MAX_KEYS) {
      return { ok: false, message: `Puedes tener hasta ${MAX_KEYS} claves activas. Revoca una que no uses.` }
    }
    const key = newApiKey()
    await db.apiKey.create({ data: { businessId: ctx.businessId, name: n.data, hint: apiKeyHint(key), hash: hashApiKey(key), createdById: ctx.user.id } })
    revalidatePath(PATH)
    return { ok: true, message: "Clave creada", data: { key } }
  } catch (error) {
    return toActionError(error)
  }
}

export async function revokeApiKey(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Clave no encontrada." }
  try {
    assertCan(ctx, "settings:manage")
    const r = await db.apiKey.updateMany({ where: { id, businessId: ctx.businessId, revokedAt: null }, data: { revokedAt: new Date() } })
    if (!r.count) return { ok: false, message: "Clave no encontrada." }
    // Los avisos que esa app creó con su clave dejan de enviarse.
    await db.webhook.deleteMany({ where: { businessId: ctx.businessId, apiKeyId: id } })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath(PATH)
  return { ok: true, message: "Clave revocada. Las apps que la usaban dejan de tener acceso y sus avisos se eliminan." }
}

const webhookSchema = z.object({
  url: z.string().trim().max(500),
  events: z.array(z.enum(["*", ...WEBHOOK_EVENTS])).min(1, "Elige al menos un evento").max(5),
  secret: z
    .string()
    .trim()
    .max(200)
    .refine((s) => s === "" || /^[\x21-\x7e]{16,200}$/.test(s), "El secreto debe tener al menos 16 caracteres, sin espacios")
    .optional(),
})

export async function addWebhook(input: z.input<typeof webhookSchema>): Promise<ActionResult<{ secret: string; generated: boolean }>> {
  const ctx = await requireBusiness()
  const parsed = webhookSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." }
  try {
    assertCan(ctx, "settings:manage")
    const problem = await checkWebhookTarget(parsed.data.url)
    if (problem) return { ok: false, message: problem }
    if ((await db.webhook.count({ where: { businessId: ctx.businessId } })) >= MAX_WEBHOOKS) {
      return { ok: false, message: `Puedes tener hasta ${MAX_WEBHOOKS} avisos. Elimina uno antes.` }
    }
    const given = parsed.data.secret || ""
    const secret = given || newWebhookSecret()
    await db.webhook.create({
      data: { businessId: ctx.businessId, url: parsed.data.url, events: [...new Set(parsed.data.events)], secret: sealSecret(secret, WEBHOOK_SECRET_PURPOSE) },
    })
    revalidatePath(PATH)
    return { ok: true, message: "Aviso agregado", data: { secret, generated: !given } }
  } catch (error) {
    return toActionError(error)
  }
}

export async function deleteWebhook(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Aviso no encontrado." }
  try {
    assertCan(ctx, "settings:manage")
    const r = await db.webhook.deleteMany({ where: { id, businessId: ctx.businessId } })
    if (!r.count) return { ok: false, message: "Aviso no encontrado." }
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath(PATH)
  return { ok: true, message: "Aviso eliminado" }
}

/** Envía un aviso de prueba ahora mismo y muestra qué respondió la otra app. También reactiva uno pausado si responde bien. */
export async function testWebhook(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Aviso no encontrado." }
  try {
    assertCan(ctx, "settings:manage")
    const h = await db.webhook.findFirst({ where: { id, businessId: ctx.businessId } })
    if (!h) return { ok: false, message: "Aviso no encontrado." }
    const body = JSON.stringify({ evento: "prueba", cuenta_id: ctx.businessId, fecha: new Date().toISOString(), data: {} })
    const r = await deliverWebhook(h.url, openSecret(h.secret, WEBHOOK_SECRET_PURPOSE), "prueba", body)
    await db.webhook.update({
      where: { id },
      data: { lastSentAt: new Date(), lastStatus: r.status, lastError: r.error, ...(r.error ? {} : { failCount: 0, active: true }) },
    })
    revalidatePath(PATH)
    return r.error ? { ok: false, message: `La prueba no llegó: ${r.error}.` } : { ok: true, message: `La prueba llegó bien (respondió ${r.status}).` }
  } catch (error) {
    return toActionError(error)
  }
}
