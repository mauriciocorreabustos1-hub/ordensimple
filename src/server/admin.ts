import "server-only"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/server/session"

/** Correos con acceso al panel /admin. Se configuran en ADMIN_EMAILS separados por coma. */
function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email) && adminEmails().includes(email!.toLowerCase())
}

/**
 * Para cualquier persona que no sea administradora, /admin "no existe" (404).
 * Además del correo, se exige que esté confirmado: así nadie entra creando una cuenta (o cambiando su correo)
 * con un correo de administrador que no es suyo. Si es el correo correcto pero sin confirmar, va al Inicio,
 * donde el aviso amarillo permite pedir el enlace de confirmación.
 */
export async function requireAdmin() {
  const session = await getSession()
  if (!session || !isAdminEmail(session.user.email)) notFound()
  if (!session.user.emailVerified) redirect("/dashboard?confirmar=admin")
  return session.user
}
