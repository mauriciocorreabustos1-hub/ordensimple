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
    "",
    "¡Muchas gracias! 🙌",
  ]
    .filter((l) => l !== null)
    .join("\n")
}

/** Respuesta del negocio al cliente cuando recibe el pedido. */
export function orderReplyText(customerName: string, code: string, businessName: string) {
  const first = customerName.split(" ")[0] || customerName
  return [
    `¡Hola, ${first}! 👋 Te escribimos de *${businessName}*.`,
    "",
    `✅ Recibimos tu pedido *n.º ${code}* y ya lo estamos preparando.`,
    "",
    "Te avisamos por aquí cuando esté listo. ¡Gracias por tu compra! 🙌",
  ].join("\n")
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
