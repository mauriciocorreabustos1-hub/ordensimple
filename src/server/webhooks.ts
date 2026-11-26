import "server-only"
import { lookup as dnsLookup, type LookupAddress } from "node:dns"
import { lookup } from "node:dns/promises"
import { request as httpsRequest } from "node:https"
import { after } from "next/server"
import { db } from "@/lib/db"
import { isPrivateIp, signWebhook, wantsEvent, webhookUrlProblem, type WebhookEvent } from "@/lib/api-v1"
import { openSecret } from "@/server/secret-box"

// Avisos (webhooks) de la API v1: cuando cambia un cliente o una orden se envía un POST firmado a las direcciones
// que configuró el negocio. Corre después de responder (after), así nunca demora una venta.

export const WEBHOOK_SECRET_PURPOSE = "webhook"
const PAUSE_AFTER_FAILS = 50
const RETRY_DELAYS = [0, 2_000, 8_000]

type Target = { kind: "cliente" | "orden"; id: string }

/** Revisa la dirección y que su dominio no lleve a una IP interna. */
export async function checkWebhookTarget(url: string): Promise<string | null> {
  const problem = webhookUrlProblem(url)
  if (problem) return problem
  try {
    const ips = await lookup(new URL(url).hostname, { all: true })
    if (!ips.length || ips.some((x) => isPrivateIp(x.address))) return "Esa dirección lleva a una red interna."
  } catch {
    return "No encontramos ese dominio. Revisa la dirección."
  }
  return null
}

/** Envía una vez. Devuelve el código HTTP (0 si no se pudo conectar). */
export async function deliverWebhook(url: string, secret: string, event: string, body: string): Promise<{ status: number; error: string | null }> {
  const problem = await checkWebhookTarget(url)
  if (problem) return { status: 0, error: problem }
  const u = new URL(url)
  return new Promise((resolve) => {
    let done = false
    const finish = (r: { status: number; error: string | null }) => {
      if (!done) {
        done = true
        clearTimeout(deadline)
        resolve(r)
      }
    }
    // Límite total de 8 segundos (aunque la otra app mande la respuesta de a poco).
    const deadline = setTimeout(() => {
      req.destroy()
      finish({ status: 0, error: "No respondió en 8 segundos" })
    }, 8_000)
    // La IP se vuelve a revisar al conectar (no solo antes): así un dominio que cambia de IP entre medio
    // (DNS rebinding) tampoco puede llevar a la red interna. No se siguen redirecciones.
    const req = httpsRequest(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: "POST",
        servername: u.hostname,
        timeout: 8_000,
        lookup: (host, opts, cb) =>
          dnsLookup(host, { all: true }, (err, addrs) => {
            if (err) return cb(err, "", 4)
            const list = addrs as LookupAddress[]
            if (!list.length || list.some((a) => isPrivateIp(a.address))) return cb(new Error("PRIVATE_IP"), "", 4)
            if ((opts as { all?: boolean }).all) return (cb as unknown as (e: null, a: LookupAddress[]) => void)(null, list)
            cb(null, list[0].address, list[0].family)
          }),
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "OrdenSimple-Webhooks/1",
          "X-OrdenSimple-Evento": event,
          "X-OrdenSimple-Firma": signWebhook(body, secret),
        },
      },
      (res) => {
        // Solo importa el código: no se lee la respuesta y se corta la conexión.
        const status = res.statusCode ?? 0
        res.destroy()
        finish({ status, error: status >= 200 && status < 300 ? null : `Respondió ${status}` })
      },
    )
    req.on("timeout", () => {
      req.destroy()
      finish({ status: 0, error: "No respondió en 8 segundos" })
    })
    req.on("error", (e) => finish({ status: 0, error: e.message === "PRIVATE_IP" ? "Esa dirección lleva a una red interna." : "No se pudo conectar" }))
    req.end(body)
  })
}

async function dispatch(businessId: string, event: WebhookEvent, target: Target) {
  const hooks = await db.webhook.findMany({
    where: { businessId, active: true },
    select: { id: true, url: true, events: true, secret: true, failCount: true, apiKeyId: true },
  })
  // Los que creó una app con una clave que ya se revocó no se envían (por si se crearon justo al revocarla).
  const keyIds = [...new Set(hooks.map((h) => h.apiKeyId).filter((k): k is string => Boolean(k)))]
  const liveKeys = keyIds.length
    ? new Set((await db.apiKey.findMany({ where: { id: { in: keyIds }, revokedAt: null }, select: { id: true } })).map((k) => k.id))
    : new Set<string>()
  const wanted = hooks.filter((h) => (!h.apiKeyId || liveKeys.has(h.apiKeyId)) && wantsEvent(h.events, event))
  if (!wanted.length) return
  const body = JSON.stringify({
    evento: event,
    cuenta_id: businessId,
    fecha: new Date().toISOString(),
    data: { id: target.id },
  })
  await Promise.all(
    wanted.map(async (h) => {
      let secret: string
      try {
        secret = openSecret(h.secret, WEBHOOK_SECRET_PURPOSE)
      } catch {
        return
      }
      let result = { status: 0, error: "Sin intentos" as string | null }
      for (const delay of RETRY_DELAYS) {
        if (delay) await new Promise((r) => setTimeout(r, delay))
        result = await deliverWebhook(h.url, secret, event, body)
        // 4xx (salvo 408 y 429) no mejora reintentando.
        if (!result.error || (result.status >= 400 && result.status < 500 && result.status !== 408 && result.status !== 429)) break
      }
      const failCount = result.error ? h.failCount + 1 : 0
      await db.webhook.update({
        where: { id: h.id },
        data: { lastSentAt: new Date(), lastStatus: result.status, lastError: result.error, failCount, ...(failCount >= PAUSE_AFTER_FAILS ? { active: false } : {}) },
      })
    }),
  )
}

/**
 * Avisa a las apps conectadas que algo cambió (`apiId` es el id de la API: ID.customer, ID.sale o ID.quote).
 * Se llama después de guardar (fuera de la transacción).
 * Nunca falla ni demora la respuesta: si el negocio no tiene webhooks, no hace nada.
 */
export function notifyIntegrations(businessId: string, event: WebhookEvent, apiId: string) {
  const target: Target = { kind: event.startsWith("cliente") ? "cliente" : "orden", id: apiId }
  try {
    after(() => dispatch(businessId, event, target).catch((e) => console.error("Webhook:", e)))
  } catch {
    // Fuera de una petición (scripts): se ignora.
  }
}
