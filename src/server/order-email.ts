import "server-only"
import { db } from "@/lib/db"
import { getAppUrl } from "@/lib/app-url"
import { sendEmail } from "@/lib/email"
import { orderConfirmationEmail } from "@/lib/email-templates"
import { orderTrackPath } from "@/lib/store"
import { whatsappLink } from "@/lib/whatsapp"
import { allowAttempt } from "@/server/rate-limit"

/** El nombre lo escribe cualquiera en la tienda: en el correo va solo el primer nombre y solo con letras (sin enlaces). */
function safeFirstName(name: string) {
  const token = name.trim().split(/\s+/)[0] ?? ""
  // Algo con puntos, barras o arrobas no es un nombre (parece un enlace o un correo): se saluda sin nombre.
  if (/[./:@]/.test(token)) return ""
  const first = token.replace(/[^\p{L}'-]/gu, "").slice(0, 30)
  return first.length >= 2 ? first : ""
}

/** La misma casilla escrita de distintas formas cuenta como una: ana+1@gmail.com y a.na@googlemail.com son ana@gmail.com. */
function mailboxKey(email: string) {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@")
  const base = local.split("+")[0]
  const gmail = domain === "gmail.com" || domain === "googlemail.com"
  return `${gmail ? base.replace(/\./g, "") : base}@${gmail ? "gmail.com" : domain}`
}

/**
 * Confirmación del pedido al correo del cliente (si lo dejó), con el enlace para ver en qué va.
 * Si el pedido se paga online, se envía cuando se paga. Las respuestas van al correo del negocio, si tiene.
 */
export async function sendOrderConfirmation(orderId: string, paid: boolean) {
  const o = await db.webOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      businessId: true,
      customerName: true,
      customerEmail: true,
      delivery: true,
      table: true,
      items: true,
      total: true,
      trackToken: true,
      business: { select: { name: true, currency: true, storeWhatsapp: true, settings: { select: { contactEmail: true } } } },
    },
  })
  if (!o?.customerEmail) return
  // Sin pagar: como máximo 3 confirmaciones al día a una misma dirección y 200 por tienda (nadie puede usar las tiendas
  // para llenar un correo ajeno). Un pedido pagado es real: su confirmación siempre sale.
  if (!paid) {
    if (!(await allowAttempt(`correo-pedido:${mailboxKey(o.customerEmail)}`, 3, 24 * 60 * 60_000))) return
    if (!(await allowAttempt(`correo-pedido-negocio:${o.businessId}`, 200, 24 * 60 * 60_000))) return
  }
  const code = o.id.slice(-5).toUpperCase()
  const email = orderConfirmationEmail({
    customerName: safeFirstName(o.customerName),
    businessName: o.business.name,
    code,
    items: o.items as { name: string; quantity: number; unitPrice: number }[],
    total: o.total,
    currency: o.business.currency,
    delivery: o.table ? `Para ${o.table}` : o.delivery ? "Despacho a domicilio" : "Retiro en el local",
    trackUrl: `${getAppUrl()}${orderTrackPath(o.trackToken)}`,
    paid,
    whatsappUrl: o.business.storeWhatsapp ? whatsappLink(o.business.storeWhatsapp, `¡Hola, ${o.business.name}! Te escribo por mi pedido n.º ${code}.`) : null,
  })
  await sendEmail({ to: o.customerEmail, ...email, replyTo: o.business.settings?.contactEmail ?? undefined })
}
