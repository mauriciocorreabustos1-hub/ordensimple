/** Dirección de la tienda: "Almacén Don Pedro" → "almacen-don-pedro". */
export function storeSlugFrom(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

export const STORE_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/

/** Direcciones que no se pueden usar (parecen de OrdenSimple). */
export const RESERVED_SLUGS = new Set(["admin", "ordensimple", "soporte", "ayuda", "tienda", "dashboard", "login", "api", "pagar", "planes", "precios"])

export function storePath(slug: string) {
  return `/tienda/${slug}`
}

/** Mensaje del pedido que el cliente le manda al negocio por WhatsApp (con emojis, ordenado para leerlo de un vistazo). */
export function orderWhatsappText(d: {
  businessName: string
  customerName: string
  customerPhone?: string | null
  delivery: boolean
  note?: string | null
  items: { name: string; quantity: number; unitPrice: number }[]
  total: string
  money: (n: number) => string
  code: string
  /** Promociones y cupón aplicados (montos a descontar). */
  promos?: { name: string; amount: number }[]
  coupon?: { code: string; amount: number } | null
  /** Mesa desde la que se pidió con la carta QR. */
  table?: string | null
  /** Enlace para seguir el pedido: queda en el chat del cliente para revisarlo cuando quiera. */
  trackUrl?: string | null
}) {
  const count = d.items.reduce((s, i) => s + i.quantity, 0)
  return [
    `🛒 *Nuevo pedido n.º ${d.code}*`,
    `¡Hola, ${d.businessName}! 👋 Quiero hacer este pedido:`,
    "",
    ...d.items.map((i) => `▪️ ${i.quantity} × ${i.name} — ${d.money(i.quantity * i.unitPrice)}`),
    ...(d.promos ?? []).map((p) => `🏷️ ${p.name}: −${d.money(p.amount)}`),
    d.coupon ? `🎟️ Cupón ${d.coupon.code}: −${d.money(d.coupon.amount)}` : null,
    "",
    `💰 *Total: ${d.total}* (${count} ${count === 1 ? "producto" : "productos"})`,
    d.table ? `🍽️ *Mesa:* ${d.table}` : d.delivery ? "🛵 *Entrega:* despacho a domicilio" : "🏪 *Entrega:* retiro en el local",
    d.note ? `${d.delivery ? "📍 *Dirección:*" : "📝 *Nota:*"} ${d.note}` : null,
    "",
    `👤 *A nombre de:* ${d.customerName}`,
    d.customerPhone ? `📞 *Teléfono:* ${d.customerPhone}` : null,
    d.trackUrl ? `\n📦 *Seguimiento del pedido:* ${d.trackUrl}` : null,
    "",
    "¡Muchas gracias! 🙌",
  ]
    .filter((l) => l !== null)
    .join("\n")
}

/** Respuesta del negocio al cliente cuando recibe el pedido. */
export function orderReplyText(customerName: string, code: string, businessName: string, trackUrl?: string) {
  const first = customerName.split(" ")[0] || customerName
  return [
    `¡Hola, ${first}! 👋 Te escribimos de *${businessName}*.`,
    "",
    `✅ Recibimos tu pedido *n.º ${code}* y ya lo estamos preparando.`,
    "",
    trackUrl ? `📦 Aquí puedes ver en qué va, cuando quieras:\n${trackUrl}\n` : null,
    "Te avisamos por aquí cuando esté listo. ¡Gracias por tu compra! 🙌",
  ]
    .filter((l) => l !== null)
    .join("\n")
}

// ─── Seguimiento del pedido ─────────────────────────────────────────────────

export type OrderStage = "RECEIVED" | "PREPARING" | "READY" | "DELIVERED"
export const ORDER_STAGES: OrderStage[] = ["RECEIVED", "PREPARING", "READY", "DELIVERED"]

export const orderTrackPath = (token: string) => `/pedido/${token}`

/** Nombre de cada etapa, según cómo se entrega el pedido. */
export function orderStageLabel(stage: OrderStage, o: { delivery: boolean; table?: string | null }) {
  if (stage === "RECEIVED") return "Recibido"
  if (stage === "PREPARING") return "En preparación"
  if (stage === "READY") return o.delivery ? "En camino" : o.table ? "Listo para servir" : "Listo para retirar"
  return "Entregado"
}

/** Aviso al cliente por WhatsApp cuando el pedido avanza. */
export function orderStageText(d: { customerName: string; code: string; businessName: string; stage: OrderStage; delivery: boolean; table?: string | null; trackUrl: string }) {
  const first = d.customerName.split(" ")[0] || d.customerName
  const news =
    d.stage === "PREPARING"
      ? `👩‍🍳 Tu pedido *n.º ${d.code}* ya se está preparando.`
      : d.stage === "READY"
        ? d.delivery
          ? `🛵 Tu pedido *n.º ${d.code}* va en camino.`
          : d.table
            ? `🍽️ Tu pedido *n.º ${d.code}* ya va a tu mesa.`
            : `🎉 Tu pedido *n.º ${d.code}* está listo para retirar.`
        : d.stage === "DELIVERED"
          ? `✅ Tu pedido *n.º ${d.code}* fue entregado. ¡Gracias por tu compra!`
          : `✅ Recibimos tu pedido *n.º ${d.code}*.`
  return [`¡Hola, ${first}! 👋 Te escribimos de *${d.businessName}*.`, "", news, "", `📦 Síguelo aquí: ${d.trackUrl}`].join("\n")
}

/** Mensaje para compartir la tienda con los clientes. */
export function storeShareText(businessName: string, url: string) {
  return [
    `🛍️ *¡${businessName} ahora tiene tienda online!*`,
    "",
    "Mira nuestros productos y precios, arma tu pedido y envíalo por WhatsApp en un minuto 👇",
    url,
    "",
    "¡Te esperamos! 😊",
  ].join("\n")
}
