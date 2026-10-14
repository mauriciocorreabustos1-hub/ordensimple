import "server-only"
import { db } from "@/lib/db"
import { addDays, startOfDay } from "@/lib/dates"

export type CustomerSegment = "todos" | "deben" | "frecuentes" | "nuevos" | "top"

export async function getCustomers(businessId: string, timezone: string, opts: { q?: string }, now = new Date()) {
  const today = startOfDay(now, timezone)
  const d30 = addDays(today, -29, timezone)
  const d60 = addDays(today, -59, timezone)

  const where = {
    businessId,
    ...(opts.q
      ? {
          OR: [
            { name: { contains: opts.q, mode: "insensitive" as const } },
            { phone: { contains: opts.q } },
            { email: { contains: opts.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [customers, totals, recent] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, phone: true, email: true, notes: true, createdAt: true },
    }),
    db.sale.groupBy({
      by: ["customerId"],
      where: { businessId, customerId: { not: null } },
      _sum: { total: true },
      _count: true,
      _max: { date: true },
    }),
    db.sale.groupBy({
      by: ["customerId"],
      where: { businessId, customerId: { not: null }, date: { gte: d60 } },
      _count: true,
    }),
  ])

  const totalsById = new Map(totals.map((t) => [t.customerId!, t]))
  const recentById = new Map(recent.map((r) => [r.customerId!, r._count]))

  const rows = customers.map((c) => {
    const t = totalsById.get(c.id)
    return {
      ...c,
      total: t?._sum.total ?? 0,
      purchases: t?._count ?? 0,
      lastPurchase: t?._max.date ?? null,
      recentPurchases: recentById.get(c.id) ?? 0,
      isNew: c.createdAt >= d30,
    }
  })

  return {
    rows,
    frequent: rows.filter((r) => r.recentPurchases >= 3),
    newOnes: rows.filter((r) => r.isNew),
    top: [...rows].filter((r) => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 10),
  }
}

export type CustomerRow = Awaited<ReturnType<typeof getCustomers>>["rows"][number]

export async function getCustomerDetail(businessId: string, id: string) {
  const customer = await db.customer.findFirst({ where: { id, businessId } })
  if (!customer) return null
  const [stats, sales] = await Promise.all([
    db.sale.aggregate({ where: { businessId, customerId: id }, _sum: { total: true }, _count: true, _max: { date: true }, _min: { date: true } }),
    db.sale.findMany({
      where: { businessId, customerId: id },
      orderBy: { date: "desc" },
      take: 30,
      select: { id: true, date: true, total: true, paymentMethod: true, items: { select: { description: true, quantity: true } } },
    }),
  ])
  return {
    customer,
    total: stats._sum.total ?? 0,
    purchases: stats._count,
    first: stats._min.date,
    last: stats._max.date,
    average: stats._count ? Math.round((stats._sum.total ?? 0) / stats._count) : 0,
    sales,
  }
}

/** Ficha de un proveedor: sus compras (gastos con su nombre) y lo que se le debe. */
export async function getSupplierDetail(businessId: string, id: string) {
  const supplier = await db.supplier.findFirst({ where: { id, businessId } })
  if (!supplier) return null
  const [stats, expenses, pending] = await Promise.all([
    db.expense.aggregate({ where: { businessId, supplierId: id }, _sum: { amount: true }, _count: true, _max: { date: true } }),
    db.expense.findMany({
      where: { businessId, supplierId: id },
      orderBy: { date: "desc" },
      take: 50,
      select: { id: true, date: true, description: true, amount: true, category: { select: { name: true } } },
    }),
    db.payable.findMany({
      where: { businessId, supplierId: id, paidAt: null },
      orderBy: { dueDate: "asc" },
      select: { id: true, description: true, amount: true, dueDate: true },
    }),
  ])
  const total = stats._sum.amount ?? 0
  return {
    supplier,
    total,
    purchases: stats._count,
    last: stats._max.date,
    average: stats._count ? Math.round(total / stats._count) : 0,
    expenses,
    pending,
    pendingTotal: pending.reduce((t, p) => t + p.amount, 0),
  }
}

export async function getSuppliers(businessId: string) {
  const [suppliers, totals] = await Promise.all([
    db.supplier.findMany({ where: { businessId }, orderBy: { name: "asc" } }),
    db.expense.groupBy({
      by: ["supplierId"],
      where: { businessId, supplierId: { not: null } },
      _sum: { amount: true },
      _count: true,
      _max: { date: true },
    }),
  ])
  const byId = new Map(totals.map((t) => [t.supplierId!, t]))
  return suppliers.map((s) => {
    const t = byId.get(s.id)
    return { ...s, spent: t?._sum.amount ?? 0, purchases: t?._count ?? 0, lastPurchase: t?._max.date ?? null }
  })
}

export type SupplierRow = Awaited<ReturnType<typeof getSuppliers>>[number]
