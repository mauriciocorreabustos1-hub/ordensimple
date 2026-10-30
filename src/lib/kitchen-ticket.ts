// La comanda impresa para la cocina: la mesa en grande, la hora y lo que hay que preparar (con sus notas).
// Sin precios: es para cocinar, no para cobrar.

import { Ticket } from "@/lib/ticket"

export type KitchenLine = { description: string; quantity: number; note?: string | null; person?: number | null }

export function kitchenTicket(label: string, items: KitchenLine[], when = new Date()) {
  const time = when.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false })
  const t = new Ticket()
  t.line(label, { big: true, center: true }).line(`Comanda ${time}`, { center: true }).rule("=")
  for (const i of items) {
    t.line(`${i.quantity} x ${i.description}`, { big: true })
    if (i.note?.trim()) t.line(`  Nota: ${i.note.trim()}`, { bold: true })
    if (i.person) t.line(`  Persona ${i.person}`)
  }
  return t.rule("=").cut()
}
