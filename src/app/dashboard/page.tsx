import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { CalendarClock, PiggyBank, Receipt, ShoppingBag, TrendingDown, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, ChangeBadge, DiffBadge } from "@/components/app/stat-card"
import { Explainer } from "@/components/app/explainer"
import { HealthCard } from "@/components/dashboard/health-card"
import { QuickButtons } from "@/components/dashboard/quick-buttons"
import { SalesExpensesChart } from "@/components/dashboard/sales-expenses-chart"
import { WelcomeToast } from "@/components/dashboard/welcome-toast"
import { businessHealth, percentChange } from "@/lib/calculations"
import { formatMoney, referenceAmount } from "@/lib/currency"
import { greeting, monthName } from "@/lib/dates"
import { getDashboardData } from "@/server/queries/dashboard"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Inicio" }

export default async function DashboardPage() {
  const ctx = await requireBusiness()
  const now = new Date()
  const data = await getDashboardData(ctx.businessId, ctx.timezone, now)
  const money = (n: number) => formatMoney(n, ctx.currency)
  const easy = ctx.settings.easyMode

  const health = businessHealth({
    sales: data.last30.sales,
    expenses: data.last30.expenses,
    prevSales: data.prev30.sales,
  })

  const daysWithoutSales = data.lastSaleAt
    ? Math.floor((now.getTime() - data.lastSaleAt.getTime()) / 86_400_000)
    : null

  const ref = referenceAmount(ctx.currency)
  const monthMargin = data.month.sales > 0 ? data.month.profit / data.month.sales : null
  const currentMonth = monthName(now, ctx.timezone)

  return (
    <div className="space-y-6">
      <Suspense>
        <WelcomeToast />
      </Suspense>

      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {greeting(now, ctx.timezone)}, {ctx.user.name.split(" ")[0]}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{ctx.business.name}</h1>
      </div>

      <HealthCard health={health} />

      {daysWithoutSales !== null && daysWithoutSales >= 3 ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <CalendarClock className="size-4 shrink-0 text-warning" />
          No has registrado ventas durante {daysWithoutSales} días. Si vendiste, anótalo para que tus números estén al día.
        </div>
      ) : null}

      <QuickButtons />

      <section aria-labelledby="hoy" className="space-y-3">
        <h2 id="hoy" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Hoy
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Ventas hoy" value={money(data.today.sales)} icon={ShoppingBag} tone="sales" size={easy ? "lg" : "default"} compactOnMobile={!easy}
            hint={data.today.salesCount === 1 ? "1 venta registrada" : `${data.today.salesCount} ventas registradas`} />
          <StatCard label="Gastos hoy" value={money(data.today.expenses)} icon={Receipt} tone="expenses" size={easy ? "lg" : "default"} compactOnMobile={!easy} />
          <StatCard
            label={data.today.profit >= 0 ? "Ganancia aproximada" : "Pérdida aproximada"}
            value={money(Math.abs(data.today.profit))}
            icon={data.today.profit >= 0 ? PiggyBank : TrendingDown}
            tone={data.today.profit >= 0 ? "profit" : "loss"}
            size={easy ? "lg" : "default"} compactOnMobile={!easy}
            hint="Ventas de hoy menos gastos de hoy."
          />
        </div>
      </section>

      {easy ? (
        <p className="text-center text-sm text-muted-foreground">
          Estás en Modo Fácil.{" "}
          <Link href="/dashboard/configuracion" className="text-primary hover:underline">
            Ver más detalles
          </Link>
        </p>
      ) : (
        <>
          <section aria-labelledby="mes" className="space-y-3">
            <h2 id="mes" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Este mes ({currentMonth})
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Ventas del mes"
                value={money(data.month.sales)}
                icon={TrendingUp}
                tone="sales"
                change={percentChange(data.month.sales, data.prevMonth.sales)}
                changeLabel="vs. mismas fechas del mes pasado"
              />
              <StatCard
                label="Gastos del mes"
                value={money(data.month.expenses)}
                icon={Receipt}
                tone="expenses"
                change={percentChange(data.month.expenses, data.prevMonth.expenses)}
                changeLabel="vs. mismas fechas del mes pasado"
                invertChange
              />
              <StatCard
                label={data.month.profit >= 0 ? "Ganancia del mes" : "Pérdida del mes"}
                value={money(Math.abs(data.month.profit))}
                icon={data.month.profit >= 0 ? PiggyBank : TrendingDown}
                tone={data.month.profit >= 0 ? "profit" : "loss"}
                hint={<DiffBadge current={data.month.profit} previous={data.prevMonth.profit} money={money} label="vs. mismas fechas del mes pasado" />}
              />
            </div>
            {monthMargin !== null && monthMargin > 0 ? (
              <Explainer title="En palabras simples">
                Este mes, por cada {money(ref)} que vendes, aproximadamente {money(Math.round(ref * monthMargin))} te
                quedan como ganancia después de tus gastos registrados.
              </Explainer>
            ) : null}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Últimos 7 días</CardTitle>
                <CardDescription>Lo que vendiste y gastaste cada día.</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesExpensesChart
                  data={data.last7}
                  currency={ctx.currency}
                  caption="Ventas y gastos de cada uno de los últimos 7 días"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Últimos 6 meses</CardTitle>
                <CardDescription>Cómo ha evolucionado tu negocio mes a mes.</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesExpensesChart
                  data={data.months}
                  currency={ctx.currency}
                  caption="Ventas y gastos de cada uno de los últimos 6 meses"
                />
              </CardContent>
            </Card>
          </div>

          <section aria-labelledby="comparar" className="space-y-3">
            <h2 id="comparar" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Comparaciones
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <ComparisonCard
                title="Esta semana vs. semana pasada"
                note="Desde el lunes hasta hoy, comparado con los mismos días de la semana pasada."
                current={data.week.sales}
                previous={data.prevWeek.sales}
                currentProfit={data.week.profit}
                previousProfit={data.prevWeek.profit}
                money={money}
              />
              <ComparisonCard
                title="Este mes vs. mes anterior"
                note="Desde el día 1 hasta hoy, comparado con las mismas fechas del mes pasado."
                current={data.month.sales}
                previous={data.prevMonth.sales}
                currentProfit={data.month.profit}
                previousProfit={data.prevMonth.profit}
                money={money}
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function ComparisonCard({
  title,
  note,
  current,
  previous,
  currentProfit,
  previousProfit,
  money,
}: {
  title: string
  note: string
  current: number
  previous: number
  currentProfit: number
  previousProfit: number
  money: (n: number) => string
}) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 md:p-5">
      <p className="font-medium">{title}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Ventas</p>
          <p className="tabular text-lg font-semibold">{money(current)}</p>
          <p className="tabular text-xs text-muted-foreground">antes: {money(previous)}</p>
          <ChangeBadge change={percentChange(current, previous)} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Ganancia aprox.</p>
          <p className={`tabular text-lg font-semibold ${currentProfit < 0 ? "text-danger" : ""}`}>{money(currentProfit)}</p>
          <p className="tabular text-xs text-muted-foreground">antes: {money(previousProfit)}</p>
          <DiffBadge current={currentProfit} previous={previousProfit} money={money} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  )
}
