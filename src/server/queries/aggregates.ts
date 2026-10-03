import "server-only"
import { db } from "@/lib/db"

export type Totals = { sales: number; expenses: number; profit: number; salesCount: number }

/** Ventas y gastos entre dos instantes [from, to). */
export async function totalsBetween(businessId: string, from: Date, to: Date): Promise<Totals> {
  const [sales, expenses] = await Promise.all([
    db.sale.aggregate({
      where: { businessId, date: { gte: from, lt: to } },
      _sum: { total: true },
      _count: true,
    }),
    db.expense.aggregate({
      where: { businessId, date: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
  ])
  const s = sales._sum.total ?? 0
  const e = expenses._sum.amount ?? 0
  return { sales: s, expenses: e, profit: s - e, salesCount: sales._count }
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
  const [sales, expenses] = await Promise.all([
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
  ])
  const toMap = (rows: Row[]) => new Map(rows.map((r) => [r.bucket, Number(r.total ?? 0)]))
  return { sales: toMap(sales), expenses: toMap(expenses) }
}
