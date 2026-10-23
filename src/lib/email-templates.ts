import "server-only"
import { getAppUrl } from "@/lib/app-url"
import { formatMoney } from "@/lib/currency"
import { WHATSAPP } from "@/lib/contact"

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
        ¿Dudas? Responde este correo, escríbenos a contacto@ordensimple.cl o por <a href="${WHATSAPP.link("Hola, tengo una consulta sobre OrdenSimple")}" style="color:${MUTED};">WhatsApp al ${WHATSAPP.display}</a>.<br>
        Síguenos en <a href="https://www.instagram.com/ordensimple.cl/" style="color:${MUTED};">Instagram</a> y <a href="https://www.tiktok.com/@ordensimple.cl" style="color:${MUTED};">TikTok</a>: @ordensimple.cl
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

/** Código del segundo paso al iniciar sesión (verificación en dos pasos). */
export function twoFactorCodeEmail({ name, code }: { name: string; code: string }) {
  const first = escapeHtml(name.split(" ")[0] ?? name)
  return {
    subject: `Tu código para entrar a OrdenSimple: ${code}`,
    html: layout({
      preview: `Tu código es ${code}. Vale por 5 minutos.`,
      body: [
        h1("Tu código para entrar"),
        p(`Hola ${first}, este es tu código para terminar de iniciar sesión:`),
        `<p style="margin:8px 0 16px;font-size:32px;font-weight:700;letter-spacing:6px;color:${GREEN};font-family:Consolas,Menlo,monospace;">${escapeHtml(code)}</p>`,
        p("Vale por <strong>5 minutos</strong>."),
        small("Si no estabas iniciando sesión, alguien tiene tu contraseña: cámbiala desde Configuración y no compartas este código."),
      ].join(""),
    }),
    text: `Hola ${name.split(" ")[0] ?? name},\n\nTu código para entrar a OrdenSimple es: ${code}\nVale por 5 minutos.\n\nSi no estabas iniciando sesión, cambia tu contraseña.`,
  }
}

/**
 * Bienvenida. Si viene verifyUrl, el botón principal confirma el correo (y entra al negocio): así la verificación
 * no gasta un correo aparte.
 */
export function welcomeEmail({ name, verifyUrl }: { name: string; verifyUrl?: string }) {
  const appUrl = getAppUrl()
  const first = escapeHtml(name.split(" ")[0] ?? name)
  return {
    subject: "¡Bienvenido a OrdenSimple!",
    html: layout({
      preview: verifyUrl ? "Confirma tu correo y empieza a ordenar tu negocio." : "Tu cuenta está lista. Así empiezas a ordenar tu negocio en 2 minutos.",
      body: [
        h1(`¡Hola ${first}, bienvenido a OrdenSimple!`),
        verifyUrl
          ? p("Tu cuenta ya está lista. Confirma que este es tu correo: así te llegan tus avisos y puedes recuperar tu cuenta si olvidas la contraseña.")
          : p("Tu cuenta ya está lista. Para sacarle provecho desde el primer día:"),
        verifyUrl ? button(verifyUrl, "Confirmar mi correo") : "",
        verifyUrl ? p("Para sacarle provecho desde el primer día:") : "",
        p(
          "1. <strong>Registra tus ventas</strong> con el botón verde. Basta con el monto.<br>2. <strong>Anota tus gastos</strong>: arriendo, luz, proveedores…<br>3. <strong>Mira cómo te va</strong> en el panel de inicio.",
        ),
        verifyUrl ? "" : button(`${appUrl}/dashboard`, "Ir a mi negocio"),
        small("¿Recién empiezas? Activa el <strong>Modo Fácil</strong> en Configuración para ver solo lo esencial."),
        verifyUrl ? small("Si no creaste una cuenta en OrdenSimple, ignora este correo.") : "",
      ].join(""),
    }),
    text: `¡Hola ${name.split(" ")[0] ?? name}, bienvenido a OrdenSimple!\n\n${verifyUrl ? `Confirma tu correo aquí: ${verifyUrl}\n\n` : ""}Tu cuenta ya está lista:\n1. Registra tus ventas con el botón verde.\n2. Anota tus gastos.\n3. Mira cómo te va en el panel de inicio.\n\nEntra aquí: ${appUrl}/dashboard`,
  }
}

/** Confirmar el correo (cuando la persona lo pide de nuevo, cambia su correo o como recordatorio). */
export function verifyEmail({ name, url, reminder = false }: { name: string; url: string; reminder?: boolean }) {
  const first = escapeHtml(name.split(" ")[0] ?? name)
  return {
    subject: reminder ? "Te falta confirmar tu correo en OrdenSimple" : "Confirma tu correo en OrdenSimple",
    html: layout({
      preview: "Un toque y listo: así te llegan tus avisos y puedes recuperar tu cuenta.",
      body: [
        h1(reminder ? `${first}, te falta un paso` : `Hola ${first}, confirma tu correo`),
        p("Toca el botón para confirmar que este es tu correo. Así te llegan tus avisos (pagos, stock, resumen semanal) y puedes recuperar tu cuenta si olvidas la contraseña."),
        button(url, "Confirmar mi correo"),
        small("El enlace dura 7 días. Si no tienes una cuenta en OrdenSimple, ignora este correo."),
      ].join(""),
    }),
    text: `Hola ${name.split(" ")[0] ?? name}, confirma tu correo en OrdenSimple: ${url}\n\nEl enlace dura 7 días.`,
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

/** "Invita a un amigo": quien invitó ganó días de plan. */
export function referralRewardEmail({
  name,
  invitedName,
  planName,
  days,
  expiresAt,
}: {
  name: string
  invitedName: string
  planName: string
  days: number
  expiresAt: Date
}) {
  const appUrl = getAppUrl()
  const firstRaw = name.split(" ")[0] ?? name
  const until = expiresAt.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago" })
  return {
    subject: `🎁 Ganaste ${days} días del plan ${planName}`,
    html: layout({
      preview: `${invitedName} se unió a OrdenSimple gracias a ti.`,
      body: [
        h1(`¡Gracias por recomendarnos, ${escapeHtml(firstRaw)}!`),
        p(`<strong>${escapeHtml(invitedName)}</strong> se unió a OrdenSimple con tu enlace. Como agradecimiento, te regalamos <strong>${days} días del plan ${escapeHtml(planName)}</strong>: lo tienes hasta el ${until}.`),
        p("Sigue compartiendo tu enlace: por cada negocio que se una, ganas más días."),
        button(`${appUrl}/dashboard/invitar`, "Ver mi enlace"),
      ].join(""),
    }),
    text: `¡Hola ${firstRaw}!

${invitedName} se unió a OrdenSimple con tu enlace. Te regalamos ${days} días del plan ${planName}, hasta el ${until}.

Tu enlace: ${appUrl}/dashboard/invitar`,
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
    <div style="font-size:12px;color:${MUTED};margin-top:6px;">Canjéalo en Configuración, sección Tu plan</div>
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
    couponCode ? `Tu código: ${couponCode} (canjéalo en Configuración, sección Tu plan)` : "",
    buttonLabel && buttonUrl ? `${buttonLabel}: ${buttonUrl}` : "",
    `---\nPara dejar de recibir ofertas: ${unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  return { subject: personalize(subject), html, text }
}

/** Correo escrito por el equipo para una persona: aviso, respuesta o seguimiento (no es publicidad). */
export function directEmail({
  name,
  subject,
  body,
  buttonLabel,
  buttonUrl,
}: {
  name: string
  subject: string
  body: string
  buttonLabel?: string | null
  buttonUrl?: string | null
}) {
  const first = name.split(" ")[0] || name
  const personalize = (s: string) => s.replaceAll("{nombre}", first)
  const paragraphs = personalize(body)
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)

  const html = layout({
    preview: paragraphs[0]?.slice(0, 120) ?? subject,
    body: [
      ...paragraphs.map((para) => p(escapeHtml(para).replace(/\n/g, "<br>"))),
      buttonLabel && buttonUrl ? button(buttonUrl, escapeHtml(buttonLabel)) : "",
    ].join(""),
  })
  const text = [...paragraphs, buttonLabel && buttonUrl ? `${buttonLabel}: ${buttonUrl}` : ""].filter(Boolean).join("\n\n")
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

/**
 * Serie de bienvenida para quienes aún no anotan ventas: día 1, día 3 y día 7.
 * hasBusiness = false cuando ni siquiera terminó de configurar su negocio.
 */
export function nudgeEmail({
  step,
  name,
  hasBusiness,
  unsubscribeUrl,
}: {
  step: 1 | 2 | 3
  name: string
  hasBusiness: boolean
  unsubscribeUrl: string
}) {
  const appUrl = getAppUrl()
  const firstRaw = name.split(" ")[0] || name
  const first = escapeHtml(firstRaw)
  const footer = `Recibes este correo porque creaste una cuenta en OrdenSimple. <a href="${unsubscribeUrl}" style="color:${MUTED};">No quiero recibir más consejos</a>.`

  const content: Record<1 | 2 | 3, { subject: string; preview: string; title: string; paragraphs: string[]; cta: string; href: string }> = {
    1: hasBusiness
      ? {
          subject: `${firstRaw}, anota tu primera venta en 10 segundos`,
          preview: "No necesitas cargar productos: basta con el monto.",
          title: "Tu primera venta, en 10 segundos",
          paragraphs: [
            `Hola ${first}, tu negocio ya está listo en OrdenSimple. Falta lo más importante: <strong>anotar tu primera venta</strong>.`,
            "Toca el botón verde <strong>+</strong>, escribe el monto y elige cómo te pagaron. Listo. No necesitas cargar productos ni llenar nada más.",
          ],
          cta: "Anotar mi primera venta",
          href: `${appUrl}/dashboard`,
        }
      : {
          subject: `${firstRaw}, te falta un paso para ordenar tu negocio`,
          preview: "Configura tu negocio en 2 minutos y empieza a anotar tus ventas.",
          title: "Te falta solo un paso",
          paragraphs: [
            `Hola ${first}, creaste tu cuenta pero aún no configuras tu negocio.`,
            "Son 2 minutos: el nombre, el rubro y un par de preguntas. Después ya puedes anotar ventas y gastos desde el celular.",
          ],
          cta: "Configurar mi negocio",
          href: `${appUrl}/onboarding`,
        },
    2: {
      subject: "El truco para no olvidarte de anotar",
      preview: "Dos formas simples de llevar tus ventas al día sin esfuerzo.",
      title: "El truco para no olvidarte de anotar",
      paragraphs: [
        `Hola ${first}, lo más difícil al principio es acordarse de anotar. Dos ideas que funcionan:`,
        "<strong>1. Al momento:</strong> deja OrdenSimple abierto en el celular junto a la caja y anota cada venta apenas la cobras.<br><strong>2. Al cerrar:</strong> si no alcanzas, anota al final del día el total vendido como una sola venta. Sirve igual para saber cuánto ganas.",
        "¿Te parece mucha información? Activa el <strong>Modo Fácil</strong> en Configuración y verás solo lo esencial.",
      ],
      cta: "Ir a OrdenSimple",
      href: `${appUrl}/dashboard`,
    },
    3: {
      subject: `${firstRaw}, ¿sabes cuánto ganó tu negocio esta semana?`,
      preview: "Con anotar tus ventas y gastos, OrdenSimple te lo dice solo.",
      title: "¿Cuánto ganaste esta semana?",
      paragraphs: [
        `Hola ${first}, muchos negocios venden harto pero no saben cuánto les queda. Con OrdenSimple lo ves al tiro, solo anotando ventas y gastos.`,
        "Además puedes llevar el <strong>fiado</strong> de tus clientes, hacer el <strong>cierre de caja</strong> al final del día y calcular <strong>a cuánto vender</strong> cada producto.",
        "Si algo no te queda claro, <strong>responde este correo</strong> y te ayudamos personalmente.",
      ],
      cta: "Ver mi negocio",
      href: `${appUrl}/dashboard`,
    },
  }

  const c = content[step]
  // Sin negocio configurado, todos los botones llevan a terminar la configuración.
  if (!hasBusiness) c.href = `${appUrl}/onboarding`
  return {
    subject: c.subject,
    html: layout({
      preview: c.preview,
      body: [h1(c.title), ...c.paragraphs.map(p), button(c.href, c.cta)].join(""),
      footer,
    }),
    text: [
      c.title,
      ...c.paragraphs.map((x) => x.replace(/<br>/g, "\n").replace(/<[^>]+>/g, "")),
      `${c.cta}: ${c.href}`,
      `---\nPara no recibir más consejos: ${unsubscribeUrl}`,
    ].join("\n\n"),
  }
}

// ─── Avisos del negocio (se activan o desactivan en Configuración) ──────────

function alertFooter() {
  return `Recibes este aviso porque lo tienes activado en OrdenSimple. <a href="${getAppUrl()}/dashboard/configuracion?seccion=avisos" style="color:${MUTED};">Cambiar mis avisos</a>.`
}

/** El resumen de los lunes llega siempre: es parte del servicio, no un aviso que se apaga. */
function weeklyFooter() {
  return `Este resumen te llega cada lunes porque tienes un negocio en OrdenSimple. <a href="${getAppUrl()}/dashboard/reportes" style="color:${MUTED};">Ver tus reportes</a>.`
}

function statRow(label: string, value: string, color = INK) {
  return `<tr>
  <td style="padding:10px 0;font-size:15px;color:${MUTED};border-bottom:1px solid #eef2f0;">${label}</td>
  <td align="right" style="padding:10px 0;font-size:17px;font-weight:700;color:${color};border-bottom:1px solid #eef2f0;">${value}</td>
</tr>`
}

function change(current: number, previous: number) {
  if (previous <= 0) return ""
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return "igual que la semana anterior"
  return pct > 0 ? `${pct}% más que la semana anterior` : `${Math.abs(pct)}% menos que la semana anterior`
}

export function weeklySummaryEmail(d: {
  name: string
  businessName: string
  weekLabel: string
  currency: string
  sales: number
  salesCount: number
  expenses: number
  profit: number
  prevSales: number
  topProducts: { name: string; qty: number }[]
  debtTotal: number
  debtCount: number
  lowStockCount: number
}) {
  const appUrl = getAppUrl()
  const money = (n: number) => formatMoney(n, d.currency)
  const first = (d.name.split(" ")[0] || d.name).trim()
  const salesChange = change(d.sales, d.prevSales)
  const profitLabel = d.profit >= 0 ? "Te quedó (aprox.)" : "Perdiste (aprox.)"
  const extras: string[] = []
  if (d.topProducts.length) {
    extras.push(`<strong>Lo más vendido:</strong> ${d.topProducts.map((p) => `${escapeHtml(p.name)} (${p.qty})`).join(", ")}.`)
  }
  if (d.debtTotal > 0) extras.push(`<strong>Fiado:</strong> te deben ${money(d.debtTotal)} entre ${d.debtCount} cliente${d.debtCount === 1 ? "" : "s"}.`)
  if (d.lowStockCount > 0) extras.push(`<strong>Por reponer:</strong> ${d.lowStockCount} producto${d.lowStockCount === 1 ? "" : "s"} con stock bajo o agotado.`)

  const html = layout({
    preview: `Vendiste ${money(d.sales)} y te quedaron ${money(Math.abs(d.profit))}. ${salesChange}`,
    body: [
      h1(`Así le fue a ${escapeHtml(d.businessName)} esta semana`),
      p(`Hola ${escapeHtml(first)}, este es tu resumen del ${escapeHtml(d.weekLabel)}.`),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
${statRow(`Ventas (${d.salesCount})`, money(d.sales), GREEN)}
${statRow("Gastos", money(d.expenses))}
${statRow(profitLabel, money(Math.abs(d.profit)), d.profit >= 0 ? GREEN : "#c2410c")}
</table>`,
      salesChange ? p(`Vendiste ${escapeHtml(salesChange)}.`) : "",
      ...extras.map((e) => p(e)),
      button(`${appUrl}/dashboard/reportes`, "Ver el detalle"),
    ].join(""),
    footer: weeklyFooter(),
  })

  const text = [
    `Hola ${first}, así le fue a ${d.businessName} (${d.weekLabel}):`,
    `Ventas (${d.salesCount}): ${money(d.sales)}\nGastos: ${money(d.expenses)}\n${profitLabel}: ${money(Math.abs(d.profit))}`,
    salesChange ? `Vendiste ${salesChange}.` : "",
    ...extras.map((e) => e.replace(/<[^>]+>/g, "")),
    `Ver el detalle: ${appUrl}/dashboard/reportes`,
  ]
    .filter(Boolean)
    .join("\n\n")

  return { subject: `Tu semana en ${d.businessName}: vendiste ${money(d.sales)}`, html, text }
}

/** Resumen de los lunes cuando la semana no tuvo ventas ni gastos anotados: en vez de ceros, una invitación a anotar. */
export function weeklyEmptyEmail(d: { name: string; businessName: string; weekLabel: string; currency: string; debtTotal: number; debtCount: number }) {
  const appUrl = getAppUrl()
  const first = (d.name.split(" ")[0] || d.name).trim()
  const debt =
    d.debtTotal > 0
      ? `Ojo: te deben ${formatMoney(d.debtTotal, d.currency)} entre ${d.debtCount} cliente${d.debtCount === 1 ? "" : "s"} con fiado.`
      : ""
  const html = layout({
    preview: `Del ${d.weekLabel} no hay ventas ni gastos anotados en ${d.businessName}.`,
    body: [
      h1(`Tu semana en ${escapeHtml(d.businessName)} quedó en blanco`),
      p(`Hola ${escapeHtml(first)}, del ${escapeHtml(d.weekLabel)} no anotaste ventas ni gastos, así que no podemos decirte cuánto ganaste.`),
      p("Anotar una venta toma unos segundos desde el celular. Si vendiste la semana pasada, todavía puedes anotarla con su fecha."),
      debt ? p(escapeHtml(debt)) : "",
      button(`${appUrl}/dashboard`, "Anotar una venta"),
    ].join(""),
    footer: weeklyFooter(),
  })
  const text = [
    `Hola ${first}, del ${d.weekLabel} no anotaste ventas ni gastos en ${d.businessName}, así que no podemos decirte cuánto ganaste.`,
    "Anotar una venta toma unos segundos desde el celular. Si vendiste la semana pasada, todavía puedes anotarla con su fecha.",
    debt,
    `Anotar una venta: ${appUrl}/dashboard`,
  ]
    .filter(Boolean)
    .join("\n\n")
  return { subject: `Tu semana en ${d.businessName} quedó en blanco`, html, text }
}

/** Recordatorio de pagos a proveedores que vencen pronto o ya vencieron. */
export function payablesEmail(d: {
  name: string
  businessName: string
  items: { description: string; supplier: string | null; amount: string; when: string; overdue: boolean }[]
}) {
  const appUrl = getAppUrl()
  const first = (d.name.split(" ")[0] || d.name).trim()
  const label = (i: (typeof d.items)[number]) => (i.supplier ? `${i.description} (${i.supplier})` : i.description)
  const html = layout({
    preview: d.items.map((i) => `${label(i)}: ${i.amount}, ${i.when}`).slice(0, 3).join(" · "),
    body: [
      h1(d.items.length === 1 ? "Tienes un pago a proveedor por vencer" : `Tienes ${d.items.length} pagos a proveedores por vencer`),
      p(`Hola ${escapeHtml(first)}, te recordamos estos pagos de ${escapeHtml(d.businessName)}:`),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;">${d.items
        .map((i) => statRow(`${escapeHtml(label(i))}<br><span style="font-size:13px;">${escapeHtml(i.when)}</span>`, i.amount, i.overdue ? "#c2410c" : INK))
        .join("")}</table>`,
      p("Cuando pagues, márcalo como pagado y quedará registrado como gasto."),
      button(`${appUrl}/dashboard/proveedores#pagos`, "Ver pagos pendientes"),
    ].join(""),
    footer: alertFooter(),
  })
  const text = [
    `Hola ${first}, te recordamos estos pagos de ${d.businessName}:`,
    d.items.map((i) => `- ${label(i)}: ${i.amount}, ${i.when}`).join("\n"),
    `Ver pagos pendientes: ${appUrl}/dashboard/proveedores#pagos`,
  ].join("\n\n")
  const firstItem = d.items[0]
  return {
    subject:
      d.items.length === 1 && firstItem
        ? `${firstItem.overdue ? "Pago atrasado" : "Pago por vencer"}: ${label(firstItem)} · ${firstItem.amount}`
        : `Tienes ${d.items.length} pagos a proveedores por vencer`,
    html,
    text,
  }
}

export function lowStockEmail(d: { name: string; businessName: string; items: { name: string; stock: number }[]; more: number }) {
  const appUrl = getAppUrl()
  const first = (d.name.split(" ")[0] || d.name).trim()
  const line = (i: { name: string; stock: number }) => (i.stock <= 0 ? `${i.name}: agotado` : `${i.name}: quedan ${i.stock}`)
  const html = layout({
    preview: d.items.map(line).slice(0, 3).join(" · "),
    body: [
      h1("Hay productos por reponer"),
      p(`Hola ${escapeHtml(first)}, en ${escapeHtml(d.businessName)} se están acabando estos productos:`),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;">${d.items
        .map((i) => statRow(escapeHtml(i.name), i.stock <= 0 ? "Agotado" : `Quedan ${i.stock}`, i.stock <= 0 ? "#c2410c" : INK))
        .join("")}</table>`,
      d.more > 0 ? p(`Y ${d.more} producto${d.more === 1 ? "" : "s"} más.`) : "",
      button(`${appUrl}/dashboard/inventario`, "Ver inventario"),
    ].join(""),
    footer: alertFooter(),
  })
  const text = [
    `Hola ${first}, en ${d.businessName} se están acabando estos productos:`,
    d.items.map(line).join("\n"),
    d.more > 0 ? `Y ${d.more} más.` : "",
    `Ver inventario: ${appUrl}/dashboard/inventario`,
  ]
    .filter(Boolean)
    .join("\n\n")
  const firstItem = d.items[0]
  return {
    subject: firstItem && d.items.length + d.more === 1 ? `Se está acabando: ${firstItem.name}` : `Tienes ${d.items.length + d.more} productos por reponer`,
    html,
    text,
  }
}

/** Productos que vencen pronto (o ya vencieron) y todavía tienen stock: para venderlos antes de perderlos. */
export function expiringEmail(d: {
  name: string
  businessName: string
  currency: string
  items: { name: string; units: number | null; value: number; days: number }[]
  more: number
}) {
  const appUrl = getAppUrl()
  const money = (n: number) => formatMoney(n, d.currency)
  const first = (d.name.split(" ")[0] || d.name).trim()
  const when = (days: number) => (days < 0 ? "Ya venció" : days === 0 ? "Vence hoy" : days === 1 ? "Vence mañana" : `En ${days} días`)
  const color = (days: number) => (days <= 1 ? "#c2410c" : days <= 3 ? "#b45309" : INK)
  const total = d.items.reduce((sum, i) => sum + i.value, 0)
  const count = d.items.length + d.more
  const rows = d.items
    .map(
      (i) => `<tr>
  <td style="padding:12px 0;font-size:15px;color:${INK};border-bottom:1px solid #eef2f0;"><strong>${escapeHtml(i.name)}</strong><br><span style="font-size:13px;color:${MUTED};">${i.units !== null ? `${i.units} unidad${i.units === 1 ? "" : "es"} · ` : ""}${money(i.value)}</span></td>
  <td align="right" style="padding:12px 0;font-size:15px;font-weight:700;color:${color(i.days)};border-bottom:1px solid #eef2f0;white-space:nowrap;">${when(i.days)}</td>
</tr>`,
    )
    .join("")
  const html = layout({
    preview: d.items.slice(0, 3).map((i) => `${i.name}: ${when(i.days).toLowerCase()}`).join(" · "),
    body: [
      h1("Tienes artículos por vencer"),
      p(`Hola ${escapeHtml(first)}, en ${escapeHtml(d.businessName)} estos artículos vencen pronto. Aún estás a tiempo de venderlos o usarlos:`),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 14px;">${rows}</table>`,
      d.more > 0 ? p(`Y ${d.more} artículo${d.more === 1 ? "" : "s"} más.`) : "",
      total > 0
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 14px;background:#fff6e8;border-radius:12px;"><tr><td style="padding:14px 16px;font-size:15px;color:#7a4a0c;">Valor en riesgo</td><td align="right" style="padding:14px 16px;font-size:18px;font-weight:700;color:#7a4a0c;">${money(total)}</td></tr></table>`
        : "",
      `<p style="margin:0 0 12px;font-size:14px;line-height:21px;color:${MUTED};background:#f3f6f5;border-radius:12px;padding:12px 14px;"><strong style="color:${INK};">Consejo:</strong> ponlos al frente del mostrador o en oferta. Si alguno se vence, regístralo como merma para que tus números cuadren.</p>`,
      button(`${appUrl}/dashboard/inventario`, "Ver lo que vence"),
    ].join(""),
    footer: alertFooter(),
  })
  const text = [
    `Hola ${first}, en ${d.businessName} estos artículos vencen pronto:`,
    d.items.map((i) => `${i.name}: ${when(i.days).toLowerCase()}${i.units !== null ? ` (${i.units} unidades)` : ""}`).join("\n"),
    d.more > 0 ? `Y ${d.more} más.` : "",
    total > 0 ? `Valor en riesgo: ${money(total)}` : "",
    `Ver lo que vence: ${appUrl}/dashboard/inventario`,
  ]
    .filter(Boolean)
    .join("\n\n")
  return { subject: count === 1 ? `Por vencer: ${d.items[0]?.name}` : `${count} artículos vencen esta semana en ${d.businessName}`, html, text }
}

export function noSalesEmail(d: { name: string; businessName: string; days: number }) {
  const appUrl = getAppUrl()
  const first = (d.name.split(" ")[0] || d.name).trim()
  const html = layout({
    preview: "Si vendiste, anótalo para que tus números estén al día.",
    body: [
      h1(`Llevas ${d.days} días sin anotar ventas`),
      p(`Hola ${escapeHtml(first)}, en ${escapeHtml(d.businessName)} no se han registrado ventas en los últimos ${d.days} días.`),
      p("Si vendiste, anótalo: puedes poner el total de cada día como una sola venta. Así tus números y tu ganancia siguen al día."),
      button(`${appUrl}/dashboard`, "Anotar ventas"),
      small("Si cerraste por unos días, ignora este mensaje."),
    ].join(""),
    footer: alertFooter(),
  })
  const text = `Hola ${first}, en ${d.businessName} no se han registrado ventas en los últimos ${d.days} días.\n\nSi vendiste, anótalo (puede ser el total de cada día como una sola venta): ${appUrl}/dashboard\n\nSi cerraste por unos días, ignora este mensaje.`
  return { subject: `${d.businessName}: llevas ${d.days} días sin anotar ventas`, html, text }
}

/** Para el dueño: clientes que se pasaron del plazo del fiado, para cobrarles. */
export function fiadoOverdueEmail(d: {
  name: string
  businessName: string
  currency: string
  days: number
  items: { name: string; balance: number; days: number }[]
  more: number
}) {
  const appUrl = getAppUrl()
  const money = (n: number) => formatMoney(n, d.currency)
  const first = (d.name.split(" ")[0] || d.name).trim()
  const count = d.items.length + d.more
  const total = d.items.reduce((sum, i) => sum + i.balance, 0)
  const rows = d.items
    .map(
      (i) => `<tr>
  <td style="padding:12px 0;font-size:15px;color:${INK};border-bottom:1px solid #eef2f0;"><strong>${escapeHtml(i.name)}</strong><br><span style="font-size:13px;color:${MUTED};">Debe hace ${i.days} días</span></td>
  <td align="right" style="padding:12px 0;font-size:15px;font-weight:700;color:${INK};border-bottom:1px solid #eef2f0;white-space:nowrap;">${money(i.balance)}</td>
</tr>`,
    )
    .join("")
  const html = layout({
    preview: `${count === 1 ? "1 cliente" : `${count} clientes`} te deben hace más de ${d.days} días`,
    body: [
      h1("Tienes fiado por cobrar"),
      p(`Hola ${escapeHtml(first)}, en ${escapeHtml(d.businessName)} ${count === 1 ? "este cliente se pasó" : "estos clientes se pasaron"} del plazo de ${d.days} días para pagar:`),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 14px;">${rows}</table>`,
      d.more > 0 ? p(`Y ${d.more} cliente${d.more === 1 ? "" : "s"} más.`) : "",
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 14px;background:#fff6e8;border-radius:12px;"><tr><td style="padding:14px 16px;font-size:15px;color:#7a4a0c;">Por cobrar${d.more ? " (los de arriba)" : ""}</td><td align="right" style="padding:14px 16px;font-size:18px;font-weight:700;color:#7a4a0c;">${money(total)}</td></tr></table>`,
      `<p style="margin:0 0 12px;font-size:14px;line-height:21px;color:${MUTED};background:#f3f6f5;border-radius:12px;padding:12px 14px;"><strong style="color:${INK};">Consejo:</strong> en Clientes tienes un botón para mandarle a cada uno un mensaje amable por WhatsApp con lo que debe.</p>`,
      button(`${appUrl}/dashboard/clientes`, "Cobrar por WhatsApp"),
    ].join(""),
    footer: alertFooter(),
  })
  const text = [
    `Hola ${first}, en ${d.businessName} estos clientes se pasaron del plazo de ${d.days} días para pagar el fiado:`,
    d.items.map((i) => `${i.name}: ${money(i.balance)} (hace ${i.days} días)`).join("\n"),
    d.more > 0 ? `Y ${d.more} más.` : "",
    `Cobrar por WhatsApp: ${appUrl}/dashboard/clientes`,
  ]
    .filter(Boolean)
    .join("\n\n")
  return { subject: count === 1 ? `${d.items[0]?.name} te debe hace ${d.items[0]?.days} días` : `${count} clientes te deben fiado hace más de ${d.days} días`, html, text }
}
