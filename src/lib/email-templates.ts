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

function layout({ preview, body }: { preview: string; body: string }) {
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
        Recibes este correo porque tienes una cuenta en OrdenSimple.<br>
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
