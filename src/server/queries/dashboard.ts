import "server-only"
import { db } from "@/lib/db"
import {
  addDays,
  formatDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
  toMonthKey,
} from "@/lib/dates"
import { seriesBetween, totalsBetween } from "@/server/queries/aggregates"

export type ChartPoint = { key: string; label: string; fullLabel: string; sales: number; expenses: number }

export async function getDashboardData(businessId: string, timezone: string, now = new Date()) {
  const todayStart = startOfDay(now, timezone)
  const tomorrow = addDays(todayStart, 1, timezone)
  const monthStart = startOfMonth(now, timezone)
  const nextMonthStart = startOfMonth(now, timezone, 1)
  const prevMonthStart = startOfMonth(now, timezone, -1)
  const weekStart = startOfWeek(now, timezone)
  const prevWeekStart = addDays(weekStart, -7, timezone)
  const sixMonthsStart = startOfMonth(now, timezone, -5)
  const sevenDaysStart = addDays(todayStart, -6, timezone)
  const last30Start = addDays(tomorrow, -30, timezone)
  const prev30Start = addDays(tomorrow, -60, timezone)

  // Comparaciones justas: el mismo tramo de tiempo transcurrido en el período anterior.
  const elapsedMonth = now.getTime() - monthStart.getTime()
  const prevMonthSamePoint = new Date(Math.min(prevMonthStart.getTime() + elapsedMonth, monthStart.getTime()))
  const elapsedWeek = now.getTime() - weekStart.getTime()
  const prevWeekSamePoint = new Date(prevWeekStart.getTime() + elapsedWeek)

  const [today, month, prevMonth, week, prevWeek, daily, monthly, lastSale, last30, prev30] = await Promise.all([
    totalsBetween(businessId, todayStart, tomorrow),
    totalsBetween(businessId, monthStart, nextMonthStart),
    totalsBetween(businessId, prevMonthStart, prevMonthSamePoint),
    totalsBetween(businessId, weekStart, tomorrow),
    totalsBetween(businessId, prevWeekStart, prevWeekSamePoint),
    seriesBetween(businessId, sevenDaysStart, tomorrow, timezone, "day"),
    seriesBetween(businessId, sixMonthsStart, nextMonthStart, timezone, "month"),
    db.sale.findFirst({ where: { businessId }, orderBy: { date: "desc" }, select: { date: true } }),
    totalsBetween(businessId, last30Start, tomorrow),
    totalsBetween(businessId, prev30Start, last30Start),
  ])

  const last7: ChartPoint[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(sevenDaysStart, i, timezone)
    const key = toDateKey(day, timezone)
    return {
      key,
      label: i === 6 ? "Hoy" : formatDate(day, timezone, { weekday: "narrow", day: "numeric" }),
      fullLabel: formatDate(day, timezone, { weekday: "long", day: "numeric", month: "long" }),
      sales: daily.sales.get(key) ?? 0,
      expenses: daily.expenses.get(key) ?? 0,
    }
  })

  const months: ChartPoint[] = Array.from({ length: 6 }, (_, i) => {
    const m = startOfMonth(now, timezone, i - 5)
    const key = toMonthKey(m, timezone)
    return {
      key,
      label: formatDate(m, timezone, { month: "short" }).replace(".", ""),
      fullLabel: formatDate(m, timezone, { month: "long", year: "numeric" }),
      sales: monthly.sales.get(key) ?? 0,
      expenses: monthly.expenses.get(key) ?? 0,
    }
  })

  return {
    today,
    month,
    prevMonth,
    week,
    prevWeek,
    last30,
    prev30,
    last7,
    months,
    lastSaleAt: lastSale?.date ?? null,
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>
