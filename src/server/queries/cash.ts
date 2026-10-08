import "server-only"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { db } from "@/lib/db"
import { addDays, dateKeyToUtc } from "@/lib/dates"

/** Todo lo que pasó en la caja en un día (zona horaria del negocio). */
export async function getCashDay(businessId: string, timezone: string, day: string) {
  const from = dateKeyToUtc(day, timezone)
  const to = addDays(from, 1, timezone)
  const range = { gte: from, lt: to }

  const [sales, payments, expenses, closing, history, withdrawals, deposits] = await Promise.all([
    db.sale.groupBy({ by: ["paymentMethod"], where: { businessId, date: range }, _sum: { total: true }, _count: true }),
    db.customerPayment.groupBy({ by: ["paymentMethod"], where: { businessId, date: range }, _sum: { amount: true }, _count: true }),
    db.expense.aggregate({ where: { businessId, date: range }, _sum: { amount: true }, _count: true }),
    db.cashClosing.findUnique({ where: { businessId_day: { businessId, day } } }),
    db.cashClosing.findMany({ where: { businessId }, orderBy: { day: "desc" }, take: 14 }),
    // Plata que el dueño sacó de la caja ese día (no es gasto, pero sale del efectivo).
    db.ownerWithdrawal.aggregate({ where: { businessId, date: range, kind: "MONEY", source: "CASH" }, _sum: { amount: true } }),
    // Plata que el dueño puso en la caja ese día (sencillo, ahorros).
    db.ownerWithdrawal.aggregate({ where: { businessId, date: range, kind: "DEPOSIT", source: "CASH" }, _sum: { amount: true } }),
  ])

  const salesBy = Object.fromEntries(sales.map((s) => [s.paymentMethod, { total: s._sum.total ?? 0, count: s._count }])) as Partial<
    Record<PaymentMethod, { total: number; count: number }>
  >
  const paymentsBy = Object.fromEntries(
    payments.map((p) => [p.paymentMethod, { total: p._sum.amount ?? 0, count: p._count }]),
  ) as Partial<Record<PaymentMethod, { total: number; count: number }>>

  return {
    day,
    salesBy,
    paymentsBy,
    salesTotal: sales.reduce((s, x) => s + (x._sum.total ?? 0), 0),
    salesCount: sales.reduce((s, x) => s + x._count, 0),
    paymentsTotal: payments.reduce((s, x) => s + (x._sum.amount ?? 0), 0),
    cashSales: salesBy.CASH?.total ?? 0,
    cashPayments: paymentsBy.CASH?.total ?? 0,
    expensesTotal: expenses._sum.amount ?? 0,
    expensesCount: expenses._count,
    withdrawalsCash: withdrawals._sum.amount ?? 0,
    depositsCash: deposits._sum.amount ?? 0,
    closing,
    history,
  }
}

export type CashDay = Awaited<ReturnType<typeof getCashDay>>
