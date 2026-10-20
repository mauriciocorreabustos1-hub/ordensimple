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
    db.sale.groupBy({ by: ["paymentMethod"], where: { businessId, date: range }, _sum: { total: true, tip: true }, _count: true }),
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
    /** Propinas: van aparte de las ventas, pero las en efectivo quedan en la caja. */
    tipsTotal: sales.reduce((s, x) => s + (x._sum.tip ?? 0), 0),
    tipsCash: sales.find((x) => x.paymentMethod === "CASH")?._sum.tip ?? 0,
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

/** Lo que pasó en la caja entre dos momentos (un turno). Mismas reglas que el cierre del día. */
export async function getCashWindow(businessId: string, from: Date, to: Date, client: Pick<typeof db, "sale" | "customerPayment" | "expense" | "ownerWithdrawal"> = db) {
  const range = { gte: from, lt: to }
  const [sales, count, cash, payments, expenses, withdrawals, deposits] = await Promise.all([
    client.sale.aggregate({ where: { businessId, date: range }, _sum: { total: true } }),
    client.sale.count({ where: { businessId, date: range, returnOfId: null } }),
    client.sale.aggregate({ where: { businessId, date: range, paymentMethod: "CASH" }, _sum: { total: true, tip: true } }),
    client.customerPayment.aggregate({ where: { businessId, date: range, paymentMethod: "CASH" }, _sum: { amount: true } }),
    client.expense.aggregate({ where: { businessId, date: range }, _sum: { amount: true } }),
    client.ownerWithdrawal.aggregate({ where: { businessId, date: range, kind: "MONEY", source: "CASH" }, _sum: { amount: true } }),
    client.ownerWithdrawal.aggregate({ where: { businessId, date: range, kind: "DEPOSIT", source: "CASH" }, _sum: { amount: true } }),
  ])
  return {
    salesTotal: sales._sum.total ?? 0,
    salesCount: count,
    cashSales: cash._sum.total ?? 0,
    tipsCash: cash._sum.tip ?? 0,
    cashPayments: payments._sum.amount ?? 0,
    expensesTotal: expenses._sum.amount ?? 0,
    withdrawalsCash: withdrawals._sum.amount ?? 0,
    depositsCash: deposits._sum.amount ?? 0,
  }
}

export type CashWindow = Awaited<ReturnType<typeof getCashWindow>>

/** Efectivo que debería haber al cerrar un turno o un día. */
export function expectedCash(opening: number, w: CashWindow, expensesFromCash: boolean) {
  const cashOut = expensesFromCash ? w.expensesTotal : 0
  return { cashOut, expected: opening + w.cashSales + w.tipsCash + w.cashPayments + w.depositsCash - cashOut - w.withdrawalsCash }
}

/** El turno abierto (si hay) y los turnos que empezaron ese día, con quién los abrió y cerró. */
export async function getShifts(businessId: string, from: Date, to: Date) {
  const include = { openedBy: { select: { name: true } }, closedBy: { select: { name: true } } } as const
  const [open, day] = await Promise.all([
    db.cashShift.findFirst({ where: { businessId, closedAt: null }, include, orderBy: { openedAt: "desc" } }),
    db.cashShift.findMany({ where: { businessId, openedAt: { gte: from, lt: to }, closedAt: { not: null } }, include, orderBy: { openedAt: "asc" } }),
  ])
  const lastClosed = open
    ? null
    : await db.cashShift.findFirst({ where: { businessId, closedAt: { not: null } }, orderBy: { closedAt: "desc" }, select: { counted: true } })
  return { open, day, openWindow: open ? await getCashWindow(businessId, open.openedAt, new Date()) : null, lastCounted: lastClosed?.counted ?? null }
}
