import "server-only"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"

/**
 * Límite simple de intentos guardado en la base de datos (la misma tabla que usa el inicio de sesión), para que
 * sirva aunque Vercel tenga varias copias del servidor. Devuelve false si ya se pasó del máximo en la ventana.
 */
export async function allowAttempt(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const row = await db.rateLimit.findUnique({ where: { key } })
  if (!row || now - Number(row.lastRequest) > windowMs) {
    await db.rateLimit.upsert({
      where: { key },
      create: { id: randomUUID(), key, count: 1, lastRequest: BigInt(now) },
      update: { count: 1, lastRequest: BigInt(now) },
    })
    return true
  }
  if (row.count >= max) return false
  await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } })
  return true
}
