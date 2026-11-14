import "server-only"
import { db } from "@/lib/db"
import { hasCardFees } from "@/lib/card-fees"
import { cardFeesBetween, cardFeesOf } from "@/server/queries/card-fees"

/** `expenses` incluye la comisión de la máquina de tarjetas (`cardFees`), si el negocio la anotó. */
export type Totals = { sales: number; expenses: number; profit: number; salesCount: number; cardFees: number }

/** Ventas y gastos entre dos instantes [from, to). */
export async function totalsBetween(businessId: string, from: Date, to: Date): Promise<Totals> {
  const [sales, count, expenses, cardFees] = await Promise.all([
    db.sale.aggregate({
      where: { businessId, date: { gte: from, lt: to } },
      _sum: { total: true },
    }),
    // Las devoluciones restan plata, pero no cuentan como una venta más.
    db.sale.count({ where: { businessId, date: { gte: from, lt: to }, returnOfId: null } }),
    db.expense.aggregate({
      where: { businessId, date: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    cardFeesBetween(businessId, from, to),
  ])
  const s = sales._sum.total ?? 0
  const e = (expenses._sum.amount ?? 0) + cardFees
  return { sales: s, expenses: e, profit: s - e, salesCount: count, cardFees }
}

type Row = { bucket: string; total: bigint | number | null }

/**
 * Sumas agrupadas por día ("YYYY-MM-DD") o mes ("YYYY-MM") en la zona horaria del negocio.
 * Las fechas se guardan en UTC; se convierten a hora local antes de agrupar.
 */
export async function seriesBetween(
  businessId: string,
  from: Date,
  to: Date,
  timezone: string,
  unit: "day" | "month",
) {
  const format = unit === "day" ? "YYYY-MM-DD" : "YYYY-MM"
  const fees = await cardFeesOf(businessId)
  const [sales, expenses, cardFees] = await Promise.all([
    db.$queryRaw<Row[]>`
      SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, ${format}) AS bucket,
             SUM("total") AS total
      FROM "sale"
      WHERE "businessId" = ${businessId} AND "date" >= ${from} AND "date" < ${to}
      GROUP BY bucket`,
    db.$queryRaw<Row[]>`
      SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, ${format}) AS bucket,
             SUM("amount") AS total
      FROM "expense"
      WHERE "businessId" = ${businessId} AND "date" >= ${from} AND "date" < ${to}
      GROUP BY bucket`,
    // Comisión de la máquina de tarjetas: cuenta como gasto del día en que se vendió.
    hasCardFees(fees)
      ? db.$queryRaw<Row[]>`
      SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, ${format}) AS bucket,
             SUM(CASE WHEN "paymentMethod" = 'DEBIT' THEN "total" * ${fees.debit}::float8 ELSE "total" * ${fees.credit}::float8 END) / 100 AS total
      FROM "sale"
      WHERE "businessId" = ${businessId} AND "date" >= ${from} AND "date" < ${to} AND "paymentMethod" IN ('DEBIT', 'CREDIT')
      GROUP BY bucket`
      : Promise.resolve([] as Row[]),
  ])
  const toMap = (rows: Row[]) => new Map(rows.map((r) => [r.bucket, Number(r.total ?? 0)]))
  const expenseMap = toMap(expenses)
  for (const r of cardFees) {
    const fee = Math.max(0, Math.round(Number(r.total ?? 0)))
    if (fee) expenseMap.set(r.bucket, (expenseMap.get(r.bucket) ?? 0) + fee)
  }
  return { sales: toMap(sales), expenses: expenseMap }
}
