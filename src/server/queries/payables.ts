import "server-only"
import { db } from "@/lib/db"

/** Pagos pendientes a proveedores (del más próximo a vencer) y los últimos pagados. */
export async function getPayables(businessId: string) {
  const [pending, paid] = await Promise.all([
    db.payable.findMany({
      where: { businessId, paidAt: null },
      orderBy: { dueDate: "asc" },
      include: { supplier: { select: { name: true } } },
    }),
    db.payable.findMany({
      where: { businessId, paidAt: { not: null } },
      orderBy: { paidAt: "desc" },
      take: 5,
      include: { supplier: { select: { name: true } } },
    }),
  ])
  return { pending, paid, total: pending.reduce((s, p) => s + p.amount, 0) }
}

/** Pagos pendientes que vencen antes de `until` (incluye los atrasados). */
export async function payablesDueBefore(businessId: string, until: Date) {
  return db.payable.findMany({
    where: { businessId, paidAt: null, dueDate: { lt: until } },
    orderBy: { dueDate: "asc" },
    select: { id: true, description: true, amount: true, dueDate: true, remindedAt: true, supplier: { select: { name: true } } },
  })
}
