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
