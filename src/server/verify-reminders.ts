import "server-only"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const DAY = 86_400_000
/** Por ejecución diaria, para no gastar el límite de correos de una vez. */
const MAX_PER_RUN = 60

/**
 * Un solo recordatorio para confirmar el correo: a quienes se registraron hace 3 a 10 días y todavía no lo
 * confirman. Usa el mismo enlace de confirmación (el correo dice "te falta un paso").
 */
export async function sendVerifyReminders(now = new Date()) {
  const users = await db.user.findMany({
    where: {
      emailVerified: false,
      verifyRemindedAt: null,
      createdAt: { gte: new Date(now.getTime() - 10 * DAY), lte: new Date(now.getTime() - 3 * DAY) },
    },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
    take: MAX_PER_RUN,
  })
  let sent = 0
  for (const u of users) {
    try {
      await auth.api.sendVerificationEmail({ body: { email: u.email, callbackURL: "/dashboard?correo=confirmado" } })
      sent++
    } catch (error) {
      console.error("[verificación] No se pudo enviar el recordatorio:", error)
    }
    // Se marca igual: si falló, no se insiste todos los días.
    await db.user.update({ where: { id: u.id }, data: { verifyRemindedAt: now } })
  }
  return { sent }
}

/** Cuántas cuentas no han confirmado su correo (y a cuántas aún no se les manda el enlace). */
export async function countUnverified() {
  const [total, pending] = await Promise.all([
    db.user.count({ where: { emailVerified: false } }),
    db.user.count({ where: { emailVerified: false, verifyRemindedAt: null } }),
  ])
  return { total, pending }
}

/**
 * Desde el panel: manda el enlace de confirmación a quienes no han confirmado y aún no lo recibieron
 * (cuentas antiguas incluidas). Como máximo `limit` por vez, para no pasar el límite diario de correos.
 */
export async function sendVerifyLinksToUnverified(limit = 80, now = new Date()) {
  const users = await db.user.findMany({
    where: { emailVerified: false, verifyRemindedAt: null },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  })
  let sent = 0
  for (const u of users) {
    try {
      await auth.api.sendVerificationEmail({ body: { email: u.email, callbackURL: "/dashboard?correo=confirmado" } })
      sent++
    } catch (error) {
      console.error("[verificación] No se pudo enviar el enlace:", error)
    }
    await db.user.update({ where: { id: u.id }, data: { verifyRemindedAt: now } })
  }
  return { sent, remaining: Math.max(0, (await countUnverified()).pending) }
}
