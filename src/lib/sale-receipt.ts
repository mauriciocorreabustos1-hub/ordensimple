// El comprobante de una venta: productos, fecha y hora, sucursal y quién atendió.
// No es una boleta tributaria (esa la emite el SII con su folio): por eso lo dice al pie.

import { allowsDecimals, quantityText, SALE_UNIT_INFO, saleUnitOf } from "@/lib/units"
import { formatMoney } from "@/lib/currency"
import { Ticket } from "@/lib/ticket"

export type SaleReceiptData = {
  /** Código corto para reconocer la venta (no es un folio tributario). */
  code: string
  businessName: string
  /** Solo si el negocio tiene más de una sucursal. */
  branchName: string | null
  taxId: string | null
  address: string | null
  phone: string | null
  dateText: string
  timeText: string
  attendedBy: string | null
  customerName: string | null
  customerPhone: string | null
  items: { description: string; quantity: number; unitPrice: number; subtotal: number; /** "u", "kg" o "m". */ unit?: string }[]
  promoDiscount: number
  discount: number
  tip: number
  total: number
  paymentLabel: string
  isReturn: boolean
  currency: string
}

export function saleReceiptTicket(d: SaleReceiptData) {
  const money = (n: number) => formatMoney(n, d.currency)
  const t = new Ticket()
  t.line(d.businessName, { bold: true, center: true })
  if (d.branchName) t.line(`Sucursal: ${d.branchName}`, { center: true })
  if (d.taxId) t.line(`RUT ${d.taxId}`, { center: true })
  if (d.address) t.line(d.address, { center: true })
  if (d.phone) t.line(d.phone, { center: true })
  t.rule()
  t.line(d.isReturn ? "Comprobante de devolución" : "Comprobante de venta", { bold: true, center: true })
  t.line(`N° ${d.code}`, { center: true })
  t.feed(1)
  t.row("Fecha", d.dateText).row("Hora", d.timeText)
  if (d.attendedBy) t.row("Atendió", d.attendedBy)
  if (d.customerName) t.row("Cliente", d.customerName)
  t.rule()
  for (const i of d.items) {
    t.row(quantityText(i.quantity, i.unit, i.description), money(i.subtotal))
    if (allowsDecimals(i.unit)) t.line(`  (${money(i.unitPrice)} el ${SALE_UNIT_INFO[saleUnitOf(i.unit)].per})`)
    else if (i.quantity > 1) t.line(`  (${money(i.unitPrice)} c/u)`)
  }
  t.rule()
  if (d.promoDiscount > 0 || d.discount > 0) {
    t.row("Subtotal", money(d.total + d.promoDiscount + d.discount))
    if (d.promoDiscount > 0) t.row("Promoción", `-${money(d.promoDiscount)}`)
    if (d.discount > 0) t.row("Descuento", `-${money(d.discount)}`)
  }
  t.row("TOTAL", money(d.total), { bold: true })
  t.row("Pago", d.paymentLabel)
  if (d.tip > 0) t.row("Propina (aparte)", money(d.tip))
  t.feed(1)
  t.line("No válido como boleta", { center: true })
  t.line("¡Gracias por tu compra!", { center: true })
  return t.cut()
}

/** El comprobante como texto, para mandarlo por WhatsApp. */
export function saleReceiptText(d: SaleReceiptData) {
  const money = (n: number) => formatMoney(n, d.currency)
  return [
    d.businessName + (d.branchName ? ` (${d.branchName})` : ""),
    `${d.isReturn ? "Comprobante de devolución" : "Comprobante de venta"} N° ${d.code}`,
    `${d.dateText}, ${d.timeText}`,
    d.attendedBy ? `Atendió: ${d.attendedBy}` : null,
    "",
    ...d.items.map((i) => `${quantityText(i.quantity, i.unit, i.description)}: ${money(i.subtotal)}`),
    "",
    `Total: ${money(d.total)} (${d.paymentLabel})`,
    "",
    "No válido como boleta. ¡Gracias por tu compra!",
  ]
    .filter((l) => l !== null)
    .join("\n")
}
