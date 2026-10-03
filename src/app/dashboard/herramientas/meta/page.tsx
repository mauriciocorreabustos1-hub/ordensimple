import type { Metadata } from "next"
import { GoalCalculator } from "@/components/tools/goal-calculator"
import { ToolShell } from "@/components/tools/tool-shell"
import { db } from "@/lib/db"
import { daysInMonth, monthName, startOfMonth, toMonthKey, zonedParts } from "@/lib/dates"
import { getBaseline } from "@/server/queries/baseline"
import { totalsBetween } from "@/server/queries/aggregates"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Meta de ganancia" }

export default async function GoalPage() {
  const ctx = await requireBusiness()
  const now = new Date()
  const [baseline, month, goal] = await Promise.all([
    getBaseline(ctx.businessId, ctx.timezone, now),
    totalsBetween(ctx.businessId, startOfMonth(now, ctx.timezone), startOfMonth(now, ctx.timezone, 1)),
    db.goal.findUnique({
      where: { businessId_month: { businessId: ctx.businessId, month: toMonthKey(now, ctx.timezone) } },
    }),
  ])

  return (
    <ToolShell
      title="¿Cuánto quieres ganar?"
      description="Escribe tu meta y te decimos cuánto vender al mes, a la semana y al día."
    >
      <GoalCalculator
        currency={ctx.currency}
        canSave={ctx.role !== "EMPLOYEE"}
        monthSales={month.sales}
        monthLabel={monthName(now, ctx.timezone)}
        daysInMonth={daysInMonth(now, ctx.timezone)}
        dayOfMonth={zonedParts(now, ctx.timezone).day}
        defaults={{
          targetProfit: goal?.targetProfit ?? 0,
          marginPct: Math.round(goal?.marginPct ?? baseline.marginPct ?? 30),
          fixedCosts: goal?.fixedCosts ?? baseline.fixedCosts,
          marginFromData: !goal && baseline.marginPct !== null,
        }}
      />
    </ToolShell>
  )
}
