import "server-only"
import { db } from "@/lib/db"
import { addDays, formatDate, toDateKey } from "@/lib/dates"
import { seriesBetween, totalsBetween } from "@/server/queries/aggregates"
import { expensesByCategory } from "@/server/queries/records"

export type ProductStat = { name: string; qty: number; revenue: number; profit: number | null }

/** Agrupa las líneas de venta por producto (o descripción) con unidades, ingresos y ganancia. */
export async function productStats(businessId: string, from: Date, to: Date) {
  const items = await db.saleItem.findMany({
    where: { sale: { businessId, date: { gte: from, lt: to } } },
    select: { productId: true, description: true, quantity: true, unitPrice: true, unitCost: true, subtotal: true },
  })
  const map = new Map<string, ProductStat & { hasCost: boolean }>()
  for (const i of items) {
    if (!i.productId && i.description === "Venta rápida") continue
    const key = i.productId ?? `d:${i.description.toLowerCase()}`
    const s = map.get(key) ?? { name: i.description, qty: 0, revenue: 0, profit: 0, hasCost: Boolean(i.productId) }
    s.qty += i.quantity
    s.revenue += i.subtotal
    if (i.productId) s.profit = (s.profit ?? 0) + i.quantity * (i.unitPrice - i.unitCost)
    map.set(key, s)
  }
  return [...map.values()].map(({ hasCost, ...s }) => ({ ...s, profit: hasCost ? s.profit : null }))
}

export async function getReport(businessId: string, from: Date, to: Date, timezone: string) {
  const length = to.getTime() - from.getTime()
  const prevFrom = new Date(from.getTime() - length)

  const [current, previous, byDay, products, categories, payments, quickTotal] = await Promise.all([
    totalsBetween(businessId, from, to),
    totalsBetween(businessId, prevFrom, from),
    seriesBetween(businessId, from, to, timezone, "day"),
    productStats(businessId, from, to),
    expensesByCategory(businessId, from, to, { cardFees: true }),
    db.sale.groupBy({
      by: ["paymentMethod"],
      where: { businessId, date: { gte: from, lt: to } },
      _sum: { total: true },
      _count: true,
    }),
    db.sale.aggregate({ where: { businessId, isQuick: true, date: { gte: from, lt: to } }, _sum: { total: true } }),
  ])

  // Serie diaria; si el período es largo se agrupa por semana para que el gráfico siga legible.
  const days: { key: string; day: Date; sales: number; expenses: number }[] = []
  for (let d = from; d < to; d = addDays(d, 1, timezone)) {
    const key = toDateKey(d, timezone)
    days.push({ key, day: d, sales: byDay.sales.get(key) ?? 0, expenses: byDay.expenses.get(key) ?? 0 })
    if (days.length > 400) break
  }
  const weekly = days.length > 31
  const chunk = weekly ? 7 : 1
  const chart = []
  for (let i = 0; i < days.length; i += chunk) {
    const group = days.slice(i, i + chunk)
    const first = group[0]
    chart.push({
      key: first.key,
      label: formatDate(first.day, timezone, weekly ? { day: "numeric", month: "short" } : { day: "numeric" }),
      fullLabel: weekly
        ? `Semana del ${formatDate(first.day, timezone, { day: "numeric", month: "long" })}`
        : formatDate(first.day, timezone, { weekday: "long", day: "numeric", month: "long" }),
      sales: group.reduce((s, x) => s + x.sales, 0),
      expenses: group.reduce((s, x) => s + x.expenses, 0),
    })
  }

  return {
    current,
    previous,
    prevFrom,
    chart,
    weekly,
    topByQty: [...products].sort((a, b) => b.qty - a.qty).slice(0, 8),
    topByProfit: products
      .filter((p): p is ProductStat & { profit: number } => p.profit !== null)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8),
    categories,
    payments: payments.map((p) => ({ method: p.paymentMethod, total: p._sum.total ?? 0, count: p._count })).sort((a, b) => b.total - a.total),
    quickSalesTotal: quickTotal._sum.total ?? 0,
  }
}

export type Report = Awaited<ReturnType<typeof getReport>>
