import "server-only"

type EmailInput = { to: string; subject: string; text: string; html?: string }

/**
 * Envía correos con Resend si RESEND_API_KEY está definido.
 * En desarrollo, sin clave, imprime el correo en la consola del servidor.
 */
export async function sendEmail({ to, subject, text, html }: EmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("[email] RESEND_API_KEY no está configurado; no se envió el correo.")
      return
    }
    console.info(`\n[email] Para: ${to}\n[email] Asunto: ${subject}\n${text}\n`)
    return
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "OrdenSimple <no-responder@ordensimple.cl>",
      reply_to: process.env.EMAIL_REPLY_TO || "contacto@ordensimple.cl",
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  })
  if (!res.ok) {
    console.error("[email] Error al enviar:", res.status, await res.text())
  }
}
