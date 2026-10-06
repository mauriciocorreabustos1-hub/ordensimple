import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { CalendarClock, ChevronRight, Crown, Landmark, NotebookPen, PiggyBank, Receipt, ShoppingBag, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, ChangeBadge, DiffBadge } from "@/components/app/stat-card"
import { Explainer } from "@/components/app/explainer"
import { HealthCard } from "@/components/dashboard/health-card"
import { QuickButtons } from "@/components/dashboard/quick-buttons"
import { SalesExpensesChart } from "@/components/dashboard/sales-expenses-chart"
import { WelcomeToast } from "@/components/dashboard/welcome-toast"
import { businessHealth, percentChange } from "@/lib/calculations"
import { formatMoney, referenceAmount } from "@/lib/currency"
import { greeting, monthName, zonedParts } from "@/lib/dates"
import { daysUntil, formatDueDate, vatDueDate, vatInfo } from "@/lib/vat"
import { getDashboardData } from "@/server/queries/dashboard"
import { getInsights } from "@/server/queries/insights"
import { getDebtors } from "@/server/queries/fiado"
import { getYearSummary } from "@/server/queries/results"
import { payablesDueBefore } from "@/server/queries/payables"
import { addDays, startOfDay } from "@/lib/dates"
import { InsightsCard } from "@/components/dashboard/insights-card"
import { canUseFeature, PLANS, PLANS_ENFORCED } from "@/lib/plans"
import { can } from "@/lib/roles"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Inicio" }

export default async function DashboardPage() {
  const ctx = await requireBusiness()
  const now = new Date()
  // Los empleados ven solo lo de hoy para registrar; las ganancias y comparaciones son del dueño.
  const showFinances = can(ctx.role, "finances:view")
  const showTips = showFinances && !ctx.settings.easyMode && canUseFeature(ctx.business.plan, "tips")
  // Lo que te deben, el IVA del mes y la utilidad (estado de resultados) para el dueño o administrador.
  const showMoneyBox = showFinances && !ctx.settings.easyMode
  const showFiado = showMoneyBox && canUseFeature(ctx.business.plan, "customers")
  const showResults = showMoneyBox && canUseFeature(ctx.business.plan, "results") && can(ctx.role, "reports:view")
  const vat = vatInfo(ctx.business.country)
  const chargesVat = Boolean(vat && ctx.settings.chargesVat)
  const today = zonedParts(now, ctx.timezone)
  const showPayables = showFinances && canUseFeature(ctx.business.plan, "suppliers") && can(ctx.role, "suppliers:manage")
  const [data, insights, debts, year, payables] = await Promise.all([
    getDashboardData(ctx.businessId, ctx.timezone, now),
    showTips ? getInsights(ctx.businessId, ctx.timezone, ctx.currency, now) : Promise.resolve([]),
    showFiado ? getDebtors(ctx.businessId) : Promise.resolve(null),
    showResults ? getYearSummary(ctx.businessId, today.year, today.month, ctx.timezone, chargesVat ? vat!.rate : null) : Promise.resolve(null),
    showPayables ? payablesDueBefore(ctx.businessId, addDays(startOfDay(now, ctx.timezone), 8, ctx.timezone)) : Promise.resolve([]),
  ])
  const payablesTotal = payables.reduce((sum, p) => sum + p.amount, 0)
  const overduePayables = payables.filter((p) => p.dueDate < startOfDay(now, ctx.timezone)).length
  const thisMonth = year?.rows[today.month - 1] ?? null
  const vatDue = vatDueDate(today.year, today.month, ctx.settings.vatDueDay, ctx.timezone)
  const vatDaysLeft = daysUntil(vatDue, now, ctx.timezone)
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

  if (!showFinances) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {greeting(now, ctx.timezone)}, {ctx.user.name.split(" ")[0]}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{ctx.business.name}</h1>
        </div>
        <QuickButtons />
        <section aria-labelledby="hoy" className="space-y-3">
          <h2 id="hoy" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Hoy en el negocio
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Ventas hoy" value={money(data.today.sales)} icon={ShoppingBag} tone="sales" size="lg"
              hint={data.today.salesCount === 1 ? "1 venta registrada" : `${data.today.salesCount} ventas registradas`} />
            <StatCard label="Gastos hoy" value={money(data.today.expenses)} icon={Receipt} tone="expenses" size="lg" />
          </div>
        </section>
        <p className="text-center text-sm text-muted-foreground">
          Anota cada venta y gasto apenas ocurra. Al cerrar el día, haz el{" "}
          <Link href="/dashboard/caja" className="text-primary hover:underline">
            cierre de caja
          </Link>
          .
        </p>
      </div>
    )
  }

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

      {PLANS_ENFORCED && ctx.business.plan === "FREE" && ctx.role === "OWNER" && PLANS.PRO.monthlyPrice ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent/40 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <Crown className="size-4 shrink-0 text-warning" />
            Estás en el plan Gratis. Con Pro ({formatMoney(PLANS.PRO.monthlyPrice, "CLP")} al mes) tienes proveedores, resultados e IVA,
            Excel, productos ilimitados y un equipo más grande.
          </span>
          <Link href="/dashboard/plan" className="font-medium text-primary hover:underline">
            Ver planes
          </Link>
        </div>
      ) : null}

      {daysWithoutSales !== null && daysWithoutSales >= 3 ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <CalendarClock className="size-4 shrink-0 text-warning" />
          No has registrado ventas durante {daysWithoutSales} días. Si vendiste, anótalo para que tus números estén al día.
        </div>
      ) : null}

      {payables.length ? (
        <Link
          href="/dashboard/proveedores#pagos"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors hover:bg-accent/40 ${overduePayables ? "border-danger/40 bg-danger/5" : "bg-card"}`}
        >
          <CalendarClock className={`size-4 shrink-0 ${overduePayables ? "text-danger" : "text-warning"}`} />
          <span className="flex-1">
            {overduePayables
              ? `Tienes ${overduePayables} pago${overduePayables === 1 ? "" : "s"} a proveedores atrasado${overduePayables === 1 ? "" : "s"}.`
              : `Esta semana vence${payables.length === 1 ? "" : "n"} ${payables.length} pago${payables.length === 1 ? "" : "s"} a proveedores.`}{" "}
            Total: <strong className="tabular">{money(payablesTotal)}</strong>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
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

      {debts || thisMonth ? (
        <section aria-labelledby="cuentas" className="space-y-3">
          <h2 id="cuentas" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Tus cuentas de {currentMonth}
          </h2>
          <div className={`grid gap-3 ${[debts, thisMonth, chargesVat && thisMonth].filter(Boolean).length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {debts ? (
              <LinkCard
                href="/dashboard/clientes?segmento=deben"
                icon={NotebookPen}
                label="Te deben (fiado)"
                value={money(debts.total)}
                tone="text-warning"
                hint={debts.count === 0 ? "Nadie te debe" : debts.count === 1 ? "1 cliente con deuda · ver quién" : `${debts.count} clientes con deuda · ver quiénes`}
              />
            ) : null}
            {thisMonth ? (
              <LinkCard
                href="/dashboard/resultados"
                icon={thisMonth.s.profit >= 0 ? PiggyBank : TrendingDown}
                label={thisMonth.s.profit >= 0 ? "Utilidad del mes" : "Pérdida del mes"}
                value={money(Math.abs(thisMonth.s.profit))}
                tone={thisMonth.s.profit >= 0 ? "text-success" : "text-danger"}
                hint={`Descontando lo que te costó lo vendido${chargesVat ? ` y sin ${vat!.label}` : ""} · ver estado de resultados`}
              />
            ) : null}
            {chargesVat && thisMonth ? (
              <LinkCard
                href="/dashboard/resultados"
                icon={Landmark}
                label={`${vat!.label} a pagar (aprox.)`}
                value={money(thisMonth.vatToPay)}
                tone="text-primary"
                hint={
                  thisMonth.vatToPay > 0
                    ? `Vence el ${formatDueDate(vatDue, ctx.timezone)} · faltan ${vatDaysLeft} días`
                    : thisMonth.carryOut > 0
                      ? `Por ahora no te toca pagar: tienes ${money(thisMonth.carryOut)} a favor`
                      : "Este mes, por ahora, no te toca pagar"
                }
              />
            ) : null}
          </div>
        </section>
      ) : null}

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

          {showTips ? <InsightsCard insights={insights} limit={4} /> : null}

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

function LinkCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  href: string
  icon: LucideIcon
  label: string
  value: string
  hint: string
  tone: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 md:p-5"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className={`size-4 ${tone}`} />
          {label}
        </p>
        <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
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
