/** Dueños de la plataforma: los correos de ADMIN_EMAILS en Vercel. */
export function ownerEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}
