import "server-only"
import { db } from "@/lib/db"
import { addDays, formatDate, startOfDay, toDateKey } from "@/lib/dates"
import type { ChartPoint } from "@/components/dashboard/sales-expenses-chart"
import { getDebtors } from "@/server/queries/fiado"

type Row = { bucket: string; total: bigint | number | null }

/**
 * Flujo de caja de un mes: la plata que de verdad entró (ventas cobradas y abonos de fiado; lo fiado no entra
 * hasta que lo pagan) y la que salió (gastos), día a día.
 */
export async function getCashFlow(businessId: string, from: Date, to: Date, timezone: string) {
  const [salesIn, paymentsIn, out, byMethod, abonosBy, byCategory, fiadoSold, withdrawalsOut] = await Promise.all([
    db.$queryRaw<Row[]>`
      SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS bucket, SUM("total") AS total
      FROM "sale" WHERE "businessId" = ${businessId} AND "date" >= ${from} AND "date" < ${to} AND "paymentMethod" <> 'FIADO'
      GROUP BY bucket`,
    db.$queryRaw<Row[]>`
      SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS bucket, SUM("amount") AS total
      FROM "customer_payment" WHERE "businessId" = ${businessId} AND "date" >= ${from} AND "date" < ${to}
      GROUP BY bucket`,
    db.$queryRaw<Row[]>`
      SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS bucket, SUM("amount") AS total
      FROM "expense" WHERE "businessId" = ${businessId} AND "date" >= ${from} AND "date" < ${to}
      GROUP BY bucket`,
    db.sale.groupBy({
      by: ["paymentMethod"],
      where: { businessId, date: { gte: from, lt: to }, paymentMethod: { not: "FIADO" } },
      _sum: { total: true },
    }),
    db.customerPayment.aggregate({ where: { businessId, date: { gte: from, lt: to } }, _sum: { amount: true } }),
    db.$queryRaw<{ name: string | null; total: bigint | number | null }[]>`
      SELECT c."name", SUM(e."amount") AS total
      FROM "expense" e LEFT JOIN "expense_category" c ON c."id" = e."categoryId"
      WHERE e."businessId" = ${businessId} AND e."date" >= ${from} AND e."date" < ${to}
      GROUP BY c."name" ORDER BY total DESC`,
    db.sale.aggregate({ where: { businessId, date: { gte: from, lt: to }, paymentMethod: "FIADO" }, _sum: { total: true } }),
    // Plata que sacó el dueño: no es gasto, pero sí sale de la caja o del banco.
    db.$queryRaw<Row[]>`
      SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS bucket, SUM("amount") AS total
      FROM "owner_withdrawal" WHERE "businessId" = ${businessId} AND "date" >= ${from} AND "date" < ${to} AND "kind" = 'MONEY'
      GROUP BY bucket`,
  ])

  const map = (rows: Row[]) => new Map(rows.map((r) => [r.bucket, Number(r.total ?? 0)]))
  const sIn = map(salesIn)
  const pIn = map(paymentsIn)
  const sOut = map(out)
  const wOut = map(withdrawalsOut)

  // Días del mes hasta hoy (o hasta el final del mes, si ya pasó).
  const today = startOfDay(new Date(), timezone)
  const last = to > addDays(today, 1, timezone) ? addDays(today, 1, timezone) : to
  const days: (ChartPoint & { balance: number })[] = []
  let balance = 0
  for (let d = from; d < last; d = addDays(d, 1, timezone)) {
    const key = toDateKey(d, timezone)
    const inflow = (sIn.get(key) ?? 0) + (pIn.get(key) ?? 0)
    const outflow = (sOut.get(key) ?? 0) + (wOut.get(key) ?? 0)
    balance += inflow - outflow
    days.push({
      key,
      label: formatDate(d, timezone, { day: "numeric" }),
      fullLabel: formatDate(d, timezone, { weekday: "long", day: "numeric", month: "long" }),
      sales: inflow,
      expenses: outflow,
      balance,
    })
  }

  const inflow = days.reduce((s, d) => s + d.sales, 0)
  const outflow = days.reduce((s, d) => s + d.expenses, 0)
  return {
    days,
    inflow,
    outflow,
    net: inflow - outflow,
    salesIn: [...sIn.values()].reduce((s, n) => s + n, 0),
    abonos: abonosBy._sum.amount ?? 0,
    byMethod: byMethod.map((m) => ({ method: m.paymentMethod, total: m._sum.total ?? 0 })).sort((a, b) => b.total - a.total),
    byCategory: byCategory.map((c) => ({ name: c.name ?? "Sin categoría", total: Number(c.total ?? 0) })),
    /** Retiros del dueño en plata (salen de la caja o del banco). */
    withdrawals: [...wOut.values()].reduce((s, n) => s + n, 0),
    /** Lo que se vendió fiado este mes: es venta, pero la plata todavía no entra. */
    fiadoSold: fiadoSold._sum.total ?? 0,
    worstDay: days.reduce<(typeof days)[number] | null>((w, d) => (d.sales - d.expenses < (w ? w.sales - w.expenses : 0) ? d : w), null),
  }
}

/** Lo que viene en los próximos 30 días: pagos a proveedores por vencer (o atrasados) y el fiado por cobrar. */
export async function getCashOutlook(businessId: string, timezone: string) {
  const limit = addDays(startOfDay(new Date(), timezone), 31, timezone)
  const [payables, debtors] = await Promise.all([
    db.payable.findMany({
      where: { businessId, paidAt: null, dueDate: { lt: limit } },
      orderBy: { dueDate: "asc" },
      select: { id: true, description: true, amount: true, dueDate: true, supplier: { select: { name: true } } },
    }),
    getDebtors(businessId),
  ])
  return {
    payables,
    payablesTotal: payables.reduce((s, p) => s + p.amount, 0),
    fiadoTotal: debtors.total,
    fiadoCount: debtors.count,
  }
}
