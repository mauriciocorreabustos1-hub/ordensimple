import "server-only"
import { db } from "@/lib/db"

/** Cuánto debe un cliente: ventas fiadas − abonos. */
export async function getCustomerBalance(businessId: string, customerId: string) {
  const [fiado, paid] = await Promise.all([
    db.sale.aggregate({ where: { businessId, customerId, paymentMethod: "FIADO" }, _sum: { total: true } }),
    db.customerPayment.aggregate({ where: { businessId, customerId }, _sum: { amount: true } }),
  ])
  return (fiado._sum.total ?? 0) - (paid._sum.amount ?? 0)
}

/** Saldos de todos los clientes con deuda (de mayor a menor). */
export async function getDebtors(businessId: string) {
  const [fiado, paid] = await Promise.all([
    db.sale.groupBy({
      by: ["customerId"],
      where: { businessId, paymentMethod: "FIADO", customerId: { not: null } },
      _sum: { total: true },
      _max: { date: true },
    }),
    db.customerPayment.groupBy({
      by: ["customerId"],
      where: { businessId },
      _sum: { amount: true },
      _max: { date: true },
    }),
  ])
  const paidBy = new Map(paid.map((p) => [p.customerId, p]))
  const balances = new Map<string, { balance: number; lastFiado: Date | null; lastPayment: Date | null }>()
  for (const f of fiado) {
    const p = paidBy.get(f.customerId!)
    const balance = (f._sum.total ?? 0) - (p?._sum.amount ?? 0)
    balances.set(f.customerId!, { balance, lastFiado: f._max.date, lastPayment: p?._max.date ?? null })
  }
  const total = [...balances.values()].reduce((s, b) => s + Math.max(0, b.balance), 0)
  return { balances, total, count: [...balances.values()].filter((b) => b.balance > 0).length }
}

/** Movimientos de fiado de un cliente: lo que se le fió y lo que abonó, del más reciente al más antiguo. */
export async function getCustomerFiadoHistory(businessId: string, customerId: string) {
  const [sales, payments] = await Promise.all([
    db.sale.findMany({
      where: { businessId, customerId, paymentMethod: "FIADO" },
      orderBy: { date: "desc" },
      take: 50,
      select: { id: true, date: true, total: true, items: { select: { description: true, quantity: true } } },
    }),
    db.customerPayment.findMany({
      where: { businessId, customerId },
      orderBy: { date: "desc" },
      take: 50,
      select: { id: true, date: true, amount: true, paymentMethod: true, note: true },
    }),
  ])
  const entries = [
    ...sales.map((s) => ({
      kind: "fiado" as const,
      id: s.id,
      date: s.date,
      amount: s.total,
      detail: s.items.map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.description}` : i.description)).join(", "),
    })),
    ...payments.map((p) => ({
      kind: "abono" as const,
      id: p.id,
      date: p.date,
      amount: p.amount,
      detail: p.note ?? "",
      paymentMethod: p.paymentMethod,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())
  return entries
}

export type OverdueDebtor = { id: string; name: string; phone: string | null; balance: number; since: Date; days: number }

/**
 * Clientes que se pasaron del plazo de pago: se descuentan los abonos de lo fiado más antiguo primero,
 * y se mira desde cuándo debe lo que queda.
 */
export async function getOverdueDebtors(businessId: string, days: number, now = new Date()): Promise<OverdueDebtor[]> {
  const { balances } = await getDebtors(businessId)
  const owing = [...balances].filter(([, b]) => b.balance > 0).map(([id]) => id)
  if (!owing.length) return []
  const [sales, paid, customers] = await Promise.all([
    db.sale.findMany({
      where: { businessId, paymentMethod: "FIADO", customerId: { in: owing } },
      select: { customerId: true, date: true, total: true },
      orderBy: { date: "asc" },
    }),
    db.customerPayment.groupBy({ by: ["customerId"], where: { businessId, customerId: { in: owing } }, _sum: { amount: true } }),
    db.customer.findMany({ where: { businessId, id: { in: owing } }, select: { id: true, name: true, phone: true } }),
  ])
  // Las devoluciones de una venta fiada también rebajan la deuda (son ventas fiadas en negativo).
  const credit = new Map(paid.map((p) => [p.customerId, p._sum.amount ?? 0]))
  for (const s of sales) if (s.total < 0) credit.set(s.customerId!, (credit.get(s.customerId!) ?? 0) - s.total)
  const since = new Map<string, Date>()
  for (const s of sales) {
    if (s.total <= 0 || since.has(s.customerId!)) continue
    const left = credit.get(s.customerId!) ?? 0
    if (left >= s.total) credit.set(s.customerId!, left - s.total)
    else since.set(s.customerId!, s.date)
  }
  const limit = now.getTime() - days * 86_400_000
  return customers
    .flatMap((c) => {
      const from = since.get(c.id)
      if (!from || from.getTime() > limit) return []
      return [{ ...c, balance: balances.get(c.id)!.balance, since: from, days: Math.floor((now.getTime() - from.getTime()) / 86_400_000) }]
    })
    .sort((a, b) => b.days - a.days)
}
