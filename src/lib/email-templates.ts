import "server-only"
import { getAppUrl } from "@/lib/app-url"

// Plantillas HTML de correo. Usan tablas y estilos en línea porque los clientes de correo
// (Gmail, Outlook) no soportan CSS moderno. Siempre van acompañadas de una versión en texto.

const GREEN = "#007653"
const INK = "#13201c"
const MUTED = "#5b6b66"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function layout({ preview, body, footer }: { preview: string; body: string; footer?: string }) {
  const appUrl = getAppUrl()
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>OrdenSimple</title>
</head>
<body style="margin:0;padding:0;background:#f3f6f5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f5;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 20px;">
        <a href="${appUrl}" style="text-decoration:none;color:${INK};">
          <img src="${appUrl}/pwa-icon/192" width="36" height="36" alt="" style="vertical-align:middle;border-radius:9px;border:0;">
          <span style="vertical-align:middle;font-size:20px;font-weight:700;margin-left:8px;">Orden<span style="color:${GREEN};">Simple</span></span>
        </a>
      </td></tr>
      <tr><td style="background:#ffffff;border-radius:16px;padding:32px 28px;border:1px solid #e3ebe7;">
        ${body}
      </td></tr>
      <tr><td style="padding:20px 4px 0;font-size:12px;line-height:18px;color:${MUTED};">
        ${footer ?? "Recibes este correo porque tienes una cuenta en OrdenSimple."}<br>
        ¿Dudas? Responde este correo o escríbenos a contacto@ordensimple.cl.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td style="background:${GREEN};border-radius:12px;">
    <a href="${href}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">${label}</a>
  </td></tr>
</table>`
}

const h1 = (text: string) =>
  `<h1 style="margin:0 0 12px;font-size:22px;line-height:28px;font-weight:700;color:${INK};">${text}</h1>`
const p = (text: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:23px;color:${INK};">${text}</p>`
const small = (text: string) => `<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:${MUTED};">${text}</p>`

export function resetPasswordEmail({ name, url }: { name: string; url: string }) {
  const first = escapeHtml(name.split(" ")[0] ?? name)
  return {
    subject: "Restablece tu contraseña de OrdenSimple",
    html: layout({
      preview: "Crea una nueva contraseña para tu cuenta. El enlace vale por 1 hora.",
      body: [
        h1("Restablece tu contraseña"),
        p(`Hola ${first}, recibimos una solicitud para cambiar la contraseña de tu cuenta.`),
        button(url, "Crear nueva contraseña"),
        p("El enlace vale por <strong>1 hora</strong>."),
        small(
          `Si no pediste este cambio, ignora este correo: tu contraseña seguirá igual.<br>Si el botón no funciona, copia este enlace en tu navegador:<br><a href="${url}" style="color:${GREEN};word-break:break-all;">${escapeHtml(url)}</a>`,
        ),
      ].join(""),
    }),
    text: `Hola ${name.split(" ")[0] ?? name},\n\nRecibimos una solicitud para cambiar la contraseña de tu cuenta de OrdenSimple.\n\nCrea una nueva aquí (vale por 1 hora):\n${url}\n\nSi no pediste este cambio, ignora este correo.`,
  }
}

export function welcomeEmail({ name }: { name: string }) {
  const appUrl = getAppUrl()
  const first = escapeHtml(name.split(" ")[0] ?? name)
  return {
    subject: "¡Bienvenido a OrdenSimple!",
    html: layout({
      preview: "Tu cuenta está lista. Así empiezas a ordenar tu negocio en 2 minutos.",
      body: [
        h1(`¡Hola ${first}, bienvenido a OrdenSimple!`),
        p("Tu cuenta ya está lista. Para sacarle provecho desde el primer día:"),
        p(
          "1. <strong>Registra tus ventas</strong> con el botón verde. Basta con el monto.<br>2. <strong>Anota tus gastos</strong>: arriendo, luz, proveedores…<br>3. <strong>Mira cómo te va</strong> en el panel de inicio.",
        ),
        button(`${appUrl}/dashboard`, "Ir a mi negocio"),
        small("¿Recién empiezas? Activa el <strong>Modo Fácil</strong> en Configuración para ver solo lo esencial."),
      ].join(""),
    }),
    text: `¡Hola ${name.split(" ")[0] ?? name}, bienvenido a OrdenSimple!\n\nTu cuenta ya está lista:\n1. Registra tus ventas con el botón verde.\n2. Anota tus gastos.\n3. Mira cómo te va en el panel de inicio.\n\nEntra aquí: ${appUrl}/dashboard`,
  }
}

export function planGiftEmail({
  name,
  planName,
  businessName,
  expiresAt,
}: {
  name: string
  planName: string
  businessName: string
  expiresAt: Date | null
}) {
  const appUrl = getAppUrl()
  const firstRaw = name.split(" ")[0] ?? name
  const until = expiresAt
    ? `hasta el ${expiresAt.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago" })}`
    : "sin fecha de término"
  return {
    subject: `🎁 Activamos el plan ${planName} en tu OrdenSimple`,
    html: layout({
      preview: `${businessName} ya tiene el plan ${planName} ${until}.`,
      body: [
        h1(`¡${escapeHtml(firstRaw)}, tienes el plan ${escapeHtml(planName)}!`),
        p(`Activamos el plan <strong>${escapeHtml(planName)}</strong> para <strong>${escapeHtml(businessName)}</strong>, ${until}. No tienes que pagar nada ni hacer ningún trámite.`),
        p("Aprovecha el inventario, los clientes y el fiado, los proveedores y los reportes para tomar mejores decisiones."),
        button(`${appUrl}/dashboard`, "Ir a mi negocio"),
      ].join(""),
    }),
    text: `¡Hola ${firstRaw}!\n\nActivamos el plan ${planName} para ${businessName}, ${until}. No tienes que pagar nada.\n\nEntra aquí: ${appUrl}/dashboard`,
  }
}

/** Correo de promoción escrito en /admin. El texto viene en párrafos separados por líneas en blanco. */
export function promoEmail({
  name,
  subject,
  body,
  buttonLabel,
  buttonUrl,
  couponCode,
  unsubscribeUrl,
}: {
  name: string
  subject: string
  body: string
  buttonLabel?: string | null
  buttonUrl?: string | null
  couponCode?: string | null
  unsubscribeUrl: string
}) {
  const first = name.split(" ")[0] || name
  const personalize = (s: string) => s.replaceAll("{nombre}", first)
  const paragraphs = personalize(body)
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)

  const coupon = couponCode
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;">
  <tr><td align="center" style="border:2px dashed ${GREEN};border-radius:12px;padding:16px;">
    <div style="font-size:13px;color:${MUTED};margin-bottom:4px;">Tu código</div>
    <div style="font-size:24px;font-weight:700;letter-spacing:2px;color:${GREEN};font-family:Consolas,Menlo,monospace;">${escapeHtml(couponCode)}</div>
    <div style="font-size:12px;color:${MUTED};margin-top:6px;">Canjéalo en Configuración → Tu plan</div>
  </td></tr>
</table>`
    : ""

  const html = layout({
    preview: paragraphs[0]?.slice(0, 120) ?? subject,
    body: [
      ...paragraphs.map((para) => p(escapeHtml(para).replace(/\n/g, "<br>"))),
      coupon,
      buttonLabel && buttonUrl ? button(buttonUrl, escapeHtml(buttonLabel)) : "",
    ].join(""),
    footer: `Recibes este correo porque aceptaste recibir novedades y ofertas de OrdenSimple. <a href="${unsubscribeUrl}" style="color:${MUTED};">Dejar de recibirlos</a>.`,
  })

  const text = [
    ...paragraphs,
    couponCode ? `Tu código: ${couponCode} (canjéalo en Configuración → Tu plan)` : "",
    buttonLabel && buttonUrl ? `${buttonLabel}: ${buttonUrl}` : "",
    `---\nPara dejar de recibir ofertas: ${unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  return { subject: personalize(subject), html, text }
}

export function invitationEmail({
  inviterName,
  businessName,
  roleLabel,
  url,
}: {
  inviterName: string
  businessName: string
  roleLabel: string
  url: string
}) {
  return {
    subject: `${inviterName} te invitó a ${businessName} en OrdenSimple`,
    html: layout({
      preview: `Únete a ${businessName} como ${roleLabel}. La invitación vale por 7 días.`,
      body: [
        h1(`Te invitaron a ${escapeHtml(businessName)}`),
        p(
          `<strong>${escapeHtml(inviterName)}</strong> te invitó a usar OrdenSimple en <strong>${escapeHtml(businessName)}</strong> como <strong>${escapeHtml(roleLabel)}</strong>.`,
        ),
        p("Si aún no tienes cuenta, la creas en un minuto con este mismo correo. Es gratis."),
        button(url, "Aceptar invitación"),
        small(
          `La invitación vale por 7 días. Si no conoces a esta persona, ignora este correo.<br>Si el botón no funciona, copia este enlace:<br><a href="${url}" style="color:${GREEN};word-break:break-all;">${escapeHtml(url)}</a>`,
        ),
      ].join(""),
    }),
    text: `${inviterName} te invitó a usar OrdenSimple en ${businessName} como ${roleLabel}.\n\nAcepta aquí (vale por 7 días):\n${url}\n\nSi no conoces a esta persona, ignora este correo.`,
  }
}
