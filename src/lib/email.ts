import "server-only"

type EmailInput = { to: string; subject: string; text: string; html?: string; headers?: Record<string, string>; /** A quién va la respuesta (por defecto, a OrdenSimple). */ replyTo?: string }

const FROM = () => process.env.EMAIL_FROM || "OrdenSimple <no-responder@ordensimple.cl>"
const REPLY_TO = () => process.env.EMAIL_REPLY_TO || "contacto@ordensimple.cl"

/**
 * Envía correos con Resend si RESEND_API_KEY está definido.
 * En desarrollo, sin clave, imprime el correo en la consola del servidor.
 */
export async function sendEmail({ to, subject, text, html, replyTo }: EmailInput) {
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
      from: FROM(),
      reply_to: replyTo || REPLY_TO(),
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

/**
 * Envío masivo: Resend acepta hasta 100 correos por llamada. Devuelve cuántos salieron y cuántos fallaron.
 * Sin RESEND_API_KEY (desarrollo) solo los muestra en la consola.
 */
export async function sendEmailBatch(emails: EmailInput[]) {
  const apiKey = process.env.RESEND_API_KEY
  let sent = 0
  let failed = 0

  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100)
    if (!apiKey) {
      if (process.env.NODE_ENV === "production") {
        console.error("[email] RESEND_API_KEY no está configurado; no se envió el lote.")
        failed += chunk.length
        continue
      }
      for (const e of chunk) console.info(`\n[email] Para: ${e.to}\n[email] Asunto: ${e.subject}\n${e.text}\n`)
      sent += chunk.length
      continue
    }

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        chunk.map((e) => ({
          from: FROM(),
          reply_to: REPLY_TO(),
          to: e.to,
          subject: e.subject,
          text: e.text,
          ...(e.html ? { html: e.html } : {}),
          ...(e.headers ? { headers: e.headers } : {}),
        })),
      ),
    })
    if (res.ok) sent += chunk.length
    else {
      failed += chunk.length
      console.error("[email] Error en envío masivo:", res.status, await res.text())
    }
    // Resend permite pocas llamadas por segundo.
    if (i + 100 < emails.length) await new Promise((r) => setTimeout(r, 600))
  }
  return { sent, failed }
}
