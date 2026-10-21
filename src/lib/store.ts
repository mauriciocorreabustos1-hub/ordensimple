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

/** Texto del pedido que el cliente le manda al negocio por WhatsApp. */
export function orderWhatsappText(d: {
  businessName: string
  customerName: string
  delivery: boolean
  note?: string | null
  items: { name: string; quantity: number; unitPrice: number }[]
  total: string
  money: (n: number) => string
  code: string
}) {
  return [
    `Hola ${d.businessName}, quiero hacer este pedido (n.º ${d.code}):`,
    "",
    ...d.items.map((i) => `• ${i.quantity} × ${i.name} — ${d.money(i.quantity * i.unitPrice)}`),
    "",
    `Total: ${d.total}`,
    d.delivery ? "Para despacho" : "Retiro en el local",
    d.note ? `Nota: ${d.note}` : null,
    `A nombre de: ${d.customerName}`,
  ]
    .filter((l) => l !== null)
    .join("\n")
}
