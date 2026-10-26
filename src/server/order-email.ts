import "server-only"
import { db } from "@/lib/db"
import { getAppUrl } from "@/lib/app-url"
import { sendEmail } from "@/lib/email"
import { orderConfirmationEmail } from "@/lib/email-templates"
import { orderTrackPath } from "@/lib/store"
import { whatsappLink } from "@/lib/whatsapp"

/**
 * Confirmación del pedido al correo del cliente (si lo dejó), con el enlace para ver en qué va.
 * Si el pedido se paga online, se envía cuando se paga. Las respuestas van al correo del negocio, si tiene.
 */
export async function sendOrderConfirmation(orderId: string, paid: boolean) {
  const o = await db.webOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
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
  const code = o.id.slice(-5).toUpperCase()
  const email = orderConfirmationEmail({
    customerName: o.customerName,
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
