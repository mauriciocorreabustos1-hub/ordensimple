import "server-only"
import type { Tx } from "@/server/sale-core"

const lastDigits = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-8)

/**
 * Cliente de un pedido o una reserva hecha en la página pública (sin cuenta): el que ya tienes con ese nombre
 * y ese teléfono, o uno nuevo (marcado "(web)" si el nombre ya existe). Nunca se cambian los datos de un
 * cliente existente con lo que escribió alguien sin cuenta.
 */
export async function webCustomer(tx: Tx, businessId: string, name: string, phone: string | null, note = "Llegó por la tienda online") {
  const sameName = await tx.customer.findMany({
    where: { businessId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, phone: true },
    take: 20,
  })
  const digits = lastDigits(phone)
  const match = digits.length === 8 ? sameName.find((c) => lastDigits(c.phone) === digits) : undefined
  if (match) return match.id
  const created = await tx.customer.create({
    data: { businessId, name: (sameName.length ? `${name} (web)` : name).slice(0, 80), phone, notes: note },
    select: { id: true },
  })
  return created.id
}
