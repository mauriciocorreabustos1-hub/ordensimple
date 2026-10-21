import "server-only"
import webpush from "web-push"
import { db } from "@/lib/db"

/** Avisos en el celular: solo funcionan si están las claves (VAPID) en las variables del servidor. */
export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

let ready = false
function setup() {
  if (ready || !pushConfigured()) return ready
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contacto@ordensimple.cl", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  ready = true
  return ready
}

export type PushMessage = {
  title: string
  body: string
  /** A dónde lleva al tocar el aviso (dentro de la app). */
  url: string
  /** Avisos con la misma etiqueta se reemplazan en vez de amontonarse. */
  tag?: string
}

/**
 * Manda un aviso a todos los celulares y computadores donde estas personas activaron los avisos.
 * Nunca falla hacia afuera: si algo sale mal, la acción que lo pidió sigue igual.
 */
export async function sendPush(userIds: string[], message: PushMessage) {
  try {
    if (!userIds.length || !setup()) return
    const subs = await db.pushSubscription.findMany({ where: { userId: { in: [...new Set(userIds)] } } })
    const payload = JSON.stringify(message)
    const gone: string[] = []
    await Promise.all(
      subs.map((s) =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12, urgency: "high" })
          .catch((error: { statusCode?: number }) => {
            // El navegador ya no acepta avisos en esa dirección (se desinstaló o se quitó el permiso).
            if (error?.statusCode === 404 || error?.statusCode === 410) gone.push(s.id)
          }),
      ),
    )
    if (gone.length) await db.pushSubscription.deleteMany({ where: { id: { in: gone } } })
  } catch (error) {
    console.error("[push] no se pudo enviar el aviso", error)
  }
}

/** Dueño y administradores de un negocio (los que aprueban y atienden pedidos). */
export async function businessManagers(businessId: string, except?: string) {
  const members = await db.businessMember.findMany({
    where: { businessId, role: { in: ["OWNER", "ADMIN"] }, ...(except ? { userId: { not: except } } : {}) },
    select: { userId: true },
  })
  return members.map((m) => m.userId)
}
