import "server-only"
import { notFound, redirect } from "next/navigation"
import { db } from "@/lib/db"
import { getSession } from "@/server/session"
import { ownerEmails } from "@/server/admin-emails"

/** ¿Es dueño de la plataforma (correo en ADMIN_EMAILS)? */
export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email) && ownerEmails().includes(email!.toLowerCase())
}

/** ¿Es administrador? Dueños (Vercel) o agregados desde el panel. */
export async function isAdmin(email: string | null | undefined) {
  if (!email) return false
  if (isAdminEmail(email)) return true
  return Boolean(await db.adminUser.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } }))
}

/** Todos los correos de administradores (para marcarlos en listas). */
export async function adminEmailSet() {
  const added = await db.adminUser.findMany({ select: { email: true } })
  return new Set([...ownerEmails(), ...added.map((a) => a.email)])
}

/** Lista para la sección "Administradores" del panel. */
export async function listAdmins() {
  const added = await db.adminUser.findMany({ orderBy: { createdAt: "asc" } })
  const emails = [...ownerEmails(), ...added.map((a) => a.email)]
  const users = await db.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, name: true, emailVerified: true, twoFactorEnabled: true },
  })
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]))
  return [
    ...ownerEmails().map((email) => ({ email, owner: true as const, addedAt: null, user: byEmail.get(email) ?? null })),
    ...added.map((a) => ({ email: a.email, owner: false as const, addedAt: a.createdAt, user: byEmail.get(a.email) ?? null })),
  ]
}

/**
 * Para cualquier persona que no sea administradora, /admin "no existe" (404).
 * Además del correo se exige:
 * - el correo confirmado: así nadie entra creando una cuenta (o cambiando su correo) con un correo de administrador
 *   que no es suyo;
 * - la verificación en dos pasos activada: aunque alguien robe la contraseña, sin el código no entra.
 * Si falta algo, va a donde se arregla (el Inicio para confirmar el correo, Configuración para el segundo paso).
 */
export async function requireAdmin() {
  const session = await getSession()
  if (!session || !(await isAdmin(session.user.email))) notFound()
  if (!session.user.emailVerified) redirect("/dashboard?confirmar=admin")
  if (!(session.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled)
    redirect("/dashboard/configuracion?dos-pasos=admin#dos-pasos")
  return session.user
}

/** Solo los dueños (ADMIN_EMAILS) pueden agregar o quitar administradores. */
export async function requireOwnerAdmin() {
  const user = await requireAdmin()
  if (!isAdminEmail(user.email)) notFound()
  return user
}
