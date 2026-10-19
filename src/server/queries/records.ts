import "server-only"
import { db } from "@/lib/db"
import { addDays, dateKeyToUtc, startOfDay, startOfMonth, toDateKey } from "@/lib/dates"
import { totalsBetween } from "@/server/queries/aggregates"

export const PAGE_SIZE = 30

export type RangeParams = { desde?: string; hasta?: string; pagina?: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Interpreta ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD en la zona del negocio. Sin filtro = este mes. */
export function parseRange(params: RangeParams, timezone: string, now = new Date()) {
  const desde = params.desde && DATE_RE.test(params.desde) ? params.desde : toDateKey(startOfMonth(now, timezone), timezone)
  const hasta = params.hasta && DATE_RE.test(params.hasta) ? params.hasta : toDateKey(now, timezone)
  let from = dateKeyToUtc(desde, timezone)
  let to = addDays(dateKeyToUtc(hasta, timezone), 1, timezone)
  if (from > to) [from, to] = [addDays(to, -1, timezone), addDays(from, 1, timezone)]
  const page = Math.min(Math.max(Number(params.pagina) || 1, 1), 50)
  return { desde, hasta, from, to, take: PAGE_SIZE * page, page }
}

export function periodTotals(businessId: string, timezone: string, now = new Date()) {
  const today = startOfDay(now, timezone)
  return Promise.all([
    totalsBetween(businessId, today, addDays(today, 1, timezone)),
    totalsBetween(businessId, startOfMonth(now, timezone), startOfMonth(now, timezone, 1)),
  ])
}

export async function listSales(businessId: string, from: Date, to: Date, take: number) {
  const where = { businessId, date: { gte: from, lt: to } }
  const [rows, count, sum] = await Promise.all([
    db.sale.findMany({
      where,
      orderBy: { date: "desc" },
      take,
      include: {
        items: { select: { description: true, quantity: true, productId: true, unitPrice: true }, orderBy: { createdAt: "asc" } },
        customer: { select: { name: true } },
        discountRequest: { select: { requestedByName: true, decidedByName: true, reason: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    db.sale.count({ where }),
    db.sale.aggregate({ where, _sum: { total: true } }),
  ])
  return { rows, count, total: sum._sum.total ?? 0 }
}

export async function listExpenses(businessId: string, from: Date, to: Date, take: number) {
  const where = { businessId, date: { gte: from, lt: to } }
  const [rows, count, sum] = await Promise.all([
    db.expense.findMany({
      where,
      orderBy: { date: "desc" },
      take,
      include: { category: { select: { name: true } }, supplier: { select: { id: true, name: true } } },
    }),
    db.expense.count({ where }),
    db.expense.aggregate({ where, _sum: { amount: true } }),
  ])
  return { rows, count, total: sum._sum.amount ?? 0 }
}

/** Gastos agrupados por categoría en un rango, de mayor a menor. */
export async function expensesByCategory(businessId: string, from: Date, to: Date) {
  const groups = await db.expense.groupBy({
    by: ["categoryId"],
    where: { businessId, date: { gte: from, lt: to } },
    _sum: { amount: true },
  })
  const ids = groups.map((g) => g.categoryId).filter((id): id is string => Boolean(id))
  const categories = ids.length
    ? await db.expenseCategory.findMany({ where: { businessId, id: { in: ids } }, select: { id: true, name: true } })
    : []
  const names = new Map(categories.map((c) => [c.id, c.name]))
  return groups
    .map((g) => ({
      id: g.categoryId ?? "none",
      name: g.categoryId ? (names.get(g.categoryId) ?? "Sin categoría") : "Sin categoría",
      total: g._sum.amount ?? 0,
    }))
    .sort((a, b) => b.total - a.total)
}
