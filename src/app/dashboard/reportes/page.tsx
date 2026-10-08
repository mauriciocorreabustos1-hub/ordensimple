import type { Metadata } from "next"
import Link from "next/link"
import { Download, Landmark, PiggyBank, Receipt, ShoppingBag, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DateRangeFilter } from "@/components/app/date-range-filter"
import { PageHeader } from "@/components/app/page-header"
import { ProGate, ProUpsell } from "@/components/app/pro-gate"
import { DiffBadge, StatCard } from "@/components/app/stat-card"
import { InsightsCard } from "@/components/dashboard/insights-card"
import { SalesExpensesChart } from "@/components/dashboard/sales-expenses-chart"
import { percentChange } from "@/lib/calculations"
import { PAYMENT_LABEL } from "@/lib/constants"
import { formatMoney, formatNumber, formatPercent } from "@/lib/currency"
import { addDays, formatDate, startOfMonth, toDateKey } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { getInsights } from "@/server/queries/insights"
import { parseRange } from "@/server/queries/records"
import { getReport } from "@/server/queries/reports"
import { trackFeature } from "@/server/feature-usage"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Reportes" }

function BarList({ items, format }: { items: { label: string; value: number; sub?: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{i.label}</span>
            <span className="tabular shrink-0 font-medium">{format(i.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(3, (i.value / max) * 100)}%` }} />
          </div>
          {i.sub ? <p className="text-xs text-muted-foreground">{i.sub}</p> : null}
        </li>
      ))}
    </ul>
  )
}

export default async function ReportsPage({ searchParams }: PageProps<"/dashboard/reportes">) {
  const ctx = await requireBusiness()
  if (!canUseFeature(ctx.business.plan, "reports")) {
    return <ProGate title="Reportes" description="Resúmenes claros de cómo le va a tu negocio." />
  }
  if (!can(ctx.role, "reports:view")) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reportes" description="Resúmenes de ventas, gastos y ganancias." />
        <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          Solo el dueño o un administrador puede ver los reportes del negocio.
        </p>
      </div>
    )
  }

  const params = await searchParams
  trackFeature(ctx.businessId, ctx.timezone, "reportes")
  const range = parseRange({ desde: params.desde as string, hasta: params.hasta as string }, ctx.timezone)
  // En Gratis: desde el mes pasado. Con Pro, cualquier fecha.
  const oldest = startOfMonth(new Date(), ctx.timezone, -1)
  const limited = !canUseFeature(ctx.business.plan, "history") && range.from < oldest
  if (limited) {
    range.from = oldest
    range.desde = toDateKey(oldest, ctx.timezone)
    if (range.to <= range.from) range.to = addDays(range.from, 1, ctx.timezone)
  }
  const [report, insights] = await Promise.all([
    getReport(ctx.businessId, range.from, range.to, ctx.timezone),
    canUseFeature(ctx.business.plan, "tips") ? getInsights(ctx.businessId, ctx.timezone, ctx.currency) : Promise.resolve([]),
  ])
  const money = (n: number) => formatMoney(n, ctx.currency)
  const { current: cur, previous: prev } = report
  const prevLabel = `vs. ${formatDate(report.prevFrom, ctx.timezone, { day: "numeric", month: "short" })} – ${formatDate(addDays(range.from, -1, ctx.timezone), ctx.timezone, { day: "numeric", month: "short" })}`
  const exportHref = (tipo: string) => `/dashboard/reportes/exportar?tipo=${tipo}&desde=${range.desde}&hasta=${range.hasta}`
  const canExport = canUseFeature(ctx.business.plan, "exports")
  const avgTicket = cur.salesCount ? Math.round(cur.sales / cur.salesCount) : 0
  const margin = cur.sales > 0 ? cur.profit / cur.sales : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Cómo le fue a tu negocio en el período que elijas, comparado con el período anterior del mismo largo."
        actions={
          <>
            <Button asChild>
              <Link href="/dashboard/resultados">
                <Landmark />
                Resultados e IVA
              </Link>
            </Button>
            {canExport ? (
              <>
                <Button variant="outline" asChild>
                  <a href={exportHref("ventas")} download>
                    <Download />
                    Ventas (Excel)
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href={exportHref("gastos")} download>
                    <Download />
                    Gastos (Excel)
                  </a>
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <DateRangeFilter desde={range.desde} hasta={range.hasta} timezone={ctx.timezone} />

      {limited ? (
        <ProUpsell
          title="Te mostramos desde el mes pasado"
          text="En el plan Gratis ves los reportes de este mes y el anterior. Con Pro revisas todo tu historial y comparas cualquier período."
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ventas" value={money(cur.sales)} icon={ShoppingBag} tone="sales"
          change={percentChange(cur.sales, prev.sales)} changeLabel={prevLabel} />
        <StatCard label="Gastos" value={money(cur.expenses)} icon={Receipt} tone="expenses"
          change={percentChange(cur.expenses, prev.expenses)} changeLabel={prevLabel} invertChange />
        <StatCard
          label={cur.profit >= 0 ? "Ganancia aproximada" : "Pérdida aproximada"}
          value={money(Math.abs(cur.profit))}
          icon={cur.profit >= 0 ? PiggyBank : TrendingDown}
          tone={cur.profit >= 0 ? "profit" : "loss"}
          hint={<DiffBadge current={cur.profit} previous={prev.profit} money={money} label={prevLabel} />}
        />
        <StatCard label="Venta promedio" value={money(avgTicket)} icon={ShoppingBag}
          hint={`${formatNumber(cur.salesCount)} ventas${margin !== null && margin > 0 ? ` · te quedó el ${formatPercent(margin, 0)} de lo vendido` : ""}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas y gastos {report.weekly ? "por semana" : "por día"}</CardTitle>
          <CardDescription>
            Del {formatDate(range.from, ctx.timezone, { day: "numeric", month: "long" })} al{" "}
            {formatDate(addDays(range.to, -1, ctx.timezone), ctx.timezone, { day: "numeric", month: "long", year: "numeric" })}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SalesExpensesChart data={report.chart} currency={ctx.currency} height={260} caption="Ventas y gastos del período" />
        </CardContent>
      </Card>

      {insights.length ? <InsightsCard insights={insights} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
            <CardDescription>Por lo que vendiste de cada uno.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.topByQty.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay ventas con detalle de productos en este período.</p>
            ) : (
              <BarList
                format={(n) => `${formatNumber(n)} ${n === 1 ? "unidad" : "unidades"}`}
                items={report.topByQty.map((p) => ({ label: p.name, value: p.qty, sub: `${money(p.revenue)} en ventas` }))}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Productos más rentables</CardTitle>
            <CardDescription>Lo que te dejó cada producto después de pagar su costo.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.topByProfit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Registra ventas de productos con su costo para ver esto.</p>
            ) : (
              <BarList
                format={money}
                items={report.topByProfit.map((p) => ({
                  label: p.name,
                  value: p.profit,
                  sub: `${formatPercent(p.revenue ? p.profit / p.revenue : 0, 0)} de margen · ${formatNumber(p.qty)} unidades`,
                }))}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoría</CardTitle>
            <CardDescription>En qué se fue la plata en este período.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay gastos en este período.</p>
            ) : (
              <BarList
                format={money}
                items={report.categories.map((c) => ({
                  label: c.name,
                  value: c.total,
                  sub: `${formatPercent(cur.expenses ? c.total / cur.expenses : 0, 0)} del total`,
                }))}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>¿Cómo te pagan?</CardTitle>
            <CardDescription>Ventas por método de pago.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay ventas en este período.</p>
            ) : (
              <BarList
                format={money}
                items={report.payments.map((p) => ({
                  label: PAYMENT_LABEL[p.method],
                  value: p.total,
                  sub: `${formatNumber(p.count)} ventas · ${formatPercent(cur.sales ? p.total / cur.sales : 0, 0)}`,
                }))}
              />
            )}
            {report.quickSalesTotal > 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">
                {money(report.quickSalesTotal)} vienen de ventas rápidas (sin detalle de productos), por eso no aparecen en
                los rankings de productos.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
