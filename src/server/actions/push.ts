"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { isPushEndpoint, pushConfigured, sendPush } from "@/server/push"
import { allowAttempt } from "@/server/rate-limit"
import { requireUser } from "@/server/session"
import { toActionError, type ActionResult } from "@/server/actions/result"

const MAX_DEVICES = 10

const subscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isPushEndpoint),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  device: z.string().trim().max(60).optional(),
})

/** Activa los avisos en este celular o computador. */
export async function subscribePush(input: z.input<typeof subscriptionSchema>): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Tu navegador no entregó los datos para los avisos. Intenta de nuevo." }
  if (!pushConfigured()) return { ok: false, message: "Los avisos en el celular todavía no están disponibles." }
  const { endpoint, keys, device } = parsed.data
  try {
    await db.$transaction(async (tx) => {
      // Si ese navegador era de otra persona (otra cuenta en el mismo celular), pasa a ser de quien lo activa ahora.
      await tx.pushSubscription.upsert({
        where: { endpoint },
        create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, device: device ?? null },
        update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, device: device ?? null },
      })
      // Solo los últimos aparatos de cada persona.
      const old = await tx.pushSubscription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: MAX_DEVICES, select: { id: true } })
      if (old.length) await tx.pushSubscription.deleteMany({ where: { id: { in: old.map((o) => o.id) } } })
    })
  } catch (error) {
    return toActionError(error)
  }
  return { ok: true, message: "Avisos activados en este aparato" }
}

/** Apaga los avisos en este aparato. */
export async function unsubscribePush(endpoint: string): Promise<ActionResult> {
  const user = await requireUser()
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false, message: "No se pudo desactivar." }
  try {
    await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } })
  } catch (error) {
    return toActionError(error)
  }
  return { ok: true, message: "Avisos desactivados en este aparato" }
}

/** Manda un aviso de prueba a los aparatos de quien lo pide. */
export async function testPush(): Promise<ActionResult> {
  const user = await requireUser()
  if (!(await allowAttempt(`aviso-prueba:${user.id}`, 5, 10 * 60_000))) return { ok: false, message: "Espera un poco antes de probar otra vez." }
  const count = await db.pushSubscription.count({ where: { userId: user.id } })
  if (!count) return { ok: false, message: "Primero activa los avisos en este aparato." }
  await sendPush([user.id], { title: "🔔 ¡Avisos activados!", body: "Así te llegarán los pedidos web y las solicitudes de tu equipo.", url: "/dashboard", tag: "prueba" })
  return { ok: true, message: "Te mandamos un aviso de prueba" }
}
