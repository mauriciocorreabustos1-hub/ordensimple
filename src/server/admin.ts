import "server-only"
import { notFound } from "next/navigation"
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

/** Para cualquier persona que no sea administradora, /admin "no existe" (404). */
export async function requireAdmin() {
  const session = await getSession()
  if (!session || !isAdminEmail(session.user.email)) notFound()
  return session.user
}
