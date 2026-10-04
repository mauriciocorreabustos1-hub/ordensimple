import "server-only"
import { db } from "@/lib/db"
import { verifyUnsubscribe } from "@/lib/unsubscribe"

/** Quita el permiso de ofertas. Devuelve false si el enlace no es válido. */
export async function unsubscribeUser(userId: unknown, token: unknown) {
  if (!verifyUnsubscribe(userId, token)) return false
  await db.user.updateMany({ where: { id: userId }, data: { marketingOptIn: false } })
  return true
}
