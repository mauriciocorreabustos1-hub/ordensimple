import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { getAppUrl } from "@/lib/app-url"

// Enlace para dejar de recibir ofertas sin iniciar sesión. Va firmado para que nadie
// pueda dar de baja a otra persona cambiando el id en la dirección.

function sign(userId: string) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("BETTER_AUTH_SECRET no está configurado")
  return createHmac("sha256", `baja:${secret}`).update(userId).digest("base64url").slice(0, 32)
}

export function unsubscribeUrl(userId: string) {
  return `${getAppUrl()}/baja?${new URLSearchParams({ u: userId, t: sign(userId) })}`
}

export function verifyUnsubscribe(userId: unknown, token: unknown): userId is string {
  if (typeof userId !== "string" || typeof token !== "string" || !userId || userId.length > 100) return false
  const expected = Buffer.from(sign(userId))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
