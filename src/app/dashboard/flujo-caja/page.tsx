import type { Metadata } from "next"
import Link from "next/link"
import { ArrowDownLeft, ArrowUpRight, CalendarClock, ChevronLeft, ChevronRight, HandCoins, Scale, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Explainer } from "@/components/app/explainer"
import { PageHeader } from "@/components/app/page-header"
import { ProUpsell } from "@/components/app/pro-gate"
import { StatCard } from "@/components/app/stat-card"
import { SalesExpensesChart } from "@/components/dashboard/sales-expenses-chart"
import { PAYMENT_LABEL } from "@/lib/constants"
import { formatMoney } from "@/lib/currency"
import { formatDate, startOfMonth, zonedParts, zonedTimeToUtc } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { redirect } from "next/navigation"
import { can } from "@/lib/roles"
import { requireBusiness } from "@/server/session"
import { getCashFlow, getCashOutlook } from "@/server/queries/cashflow"
import { daysUntil } from "@/lib/vat"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Flujo de caja" }

const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`

export default async function CashFlowPage({ searchParams }: PageProps<"/dashboard/flujo-caja">) {
  const ctx = await requireBusiness()
  if (!can(ctx.role, "finances:view")) redirect("/dashboard")
  const params = await searchParams
  const now = new Date()
  const today = zonedParts(now, ctx.timezone)
  const plus = canUseFeature(ctx.business.plan, "cashflowPlus")

  // Mes elegido (?mes=AAAA-MM). En Gratis, solo el mes actual.
  const wanted = typeof params.mes === "string" && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes.split("-").map(Number) : null
  const askedPast = Boolean(wanted && key(wanted[0], wanted[1]) !== key(today.year, today.month))
  let [year, month] = wanted && plus ? wanted : [today.year, today.month]
  if (key(year, month) > key(today.year, today.month)) [year, month] = [today.year, today.month]
  const isCurrent = key(year, month) === key(today.year, today.month)

  const from = zonedTimeToUtc(year, month, 1, ctx.timezone)
  const to = startOfMonth(from, ctx.timezone, 1)
  const [flow, outlook] = await Promise.all([
    getCashFlow(ctx.businessId, from, to, ctx.timezone),
    plus && isCurrent ? getCashOutlook(ctx.businessId, ctx.timezone) : Promise.resolve(null),
  ])
  const money = (n: number) => formatMoney(n, ctx.currency)
  const monthText = formatDate(from, ctx.timezone, { month: "long", year: "numeric" })
  const monthLabel = monthText.charAt(0).toUpperCase() + monthText.slice(1)
  const prev = month === 1 ? key(year - 1, 12) : key(year, month - 1)
  const next = month === 12 ? key(year + 1, 1) : key(year, month + 1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flujo de caja"
        description="La plata que de verdad entra y sale de tu negocio. Lo fiado cuenta cuando te lo pagan."
        actions={
          <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between">
            <Button variant="outline" size="icon" asChild>
              <Link href={`/dashboard/flujo-caja?mes=${prev}`} aria-label="Mes anterior">
                <ChevronLeft />
              </Link>
            </Button>
            <span className="min-w-36 text-center text-sm font-medium">{monthLabel}</span>
            {isCurrent ? (
              <Button variant="outline" size="icon" disabled aria-label="Mes siguiente">
                <ChevronRight />
              </Button>
            ) : (
              <Button variant="outline" size="icon" asChild>
                <Link href={`/dashboard/flujo-caja?mes=${next}`} aria-label="Mes siguiente">
                  <ChevronRight />
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {askedPast && !plus ? (
        <ProUpsell title="Los meses anteriores son parte de Pro" text="En el plan Gratis ves el flujo de caja de este mes. Con Pro revisas todos los meses y lo que viene." />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard compactOnMobile label="Entró" value={money(flow.inflow)} icon={ArrowDownLeft} tone="sales" hint="Ventas cobradas y abonos de fiado." />
        <StatCard compactOnMobile label="Salió" value={money(flow.outflow)} icon={ArrowUpRight} tone="expenses" hint="Gastos pagados." />
        <StatCard
          compactOnMobile
          label={flow.net >= 0 ? "Te quedó en caja" : "Salió más de lo que entró"}
          value={money(Math.abs(flow.net))}
          icon={Scale}
          tone={flow.net >= 0 ? "profit" : "loss"}
          hint={isCurrent ? "Este mes, hasta hoy." : "En todo el mes."}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Día a día</CardTitle>
          <CardDescription>Cuánto entró y salió cada día del mes.</CardDescription>
        </CardHeader>
        <CardContent>
          <SalesExpensesChart
            data={flow.days}
            currency={ctx.currency}
            caption={`Entradas y salidas de plata por día en ${monthText}`}
            labels={{ sales: "Entró", expenses: "Salió", gain: "Quedó", loss: "Faltó" }}
          />
          {flow.days.length ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Saldo acumulado del mes:{" "}
              <strong className={cn("tabular", flow.net < 0 ? "text-danger" : "text-foreground")}>{money(flow.net)}</strong>
              {flow.worstDay && flow.worstDay.sales - flow.worstDay.expenses < 0
                ? ` · El día que más plata salió fue el ${flow.worstDay.fullLabel} (${money(flow.worstDay.expenses - flow.worstDay.sales)} más de lo que entró).`
                : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownLeft className="size-4 text-success" />
              ¿De dónde entró?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {flow.byMethod.map((m) => (
                <li key={m.method} className="flex justify-between gap-3 py-2.5">
                  <span>Ventas en {PAYMENT_LABEL[m.method].toLowerCase()}</span>
                  <span className="tabular font-medium">{money(m.total)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3 py-2.5">
                <span>Abonos de fiado</span>
                <span className="tabular font-medium">{money(flow.abonos)}</span>
              </li>
              <li className="flex justify-between gap-3 pt-3 font-semibold">
                <span>Total que entró</span>
                <span className="tabular">{money(flow.inflow)}</span>
              </li>
            </ul>
            {flow.fiadoSold ? (
              <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                Además vendiste {money(flow.fiadoSold)} fiado: es venta, pero la plata entra cuando te la paguen.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="size-4 text-danger" />
              ¿En qué salió?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flow.byCategory.length ? (
              <ul className="divide-y text-sm">
                {flow.byCategory.slice(0, 8).map((c) => (
                  <li key={c.name} className="flex justify-between gap-3 py-2.5">
                    <span>{c.name}</span>
                    <span className="tabular font-medium">{money(c.total)}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-3 pt-3 font-semibold">
                  <span>Total que salió</span>
                  <span className="tabular">{money(flow.outflow)}</span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No registraste gastos este mes.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {isCurrent ? (
        outlook ? (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-5 text-primary" />
                Lo que viene (próximos 30 días)
              </CardTitle>
              <CardDescription>Plata que debería entrar y salir pronto, para que no te pille.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <HandCoins className="size-3.5" /> Fiado por cobrar
                  </p>
                  <p className={cn("tabular mt-1 text-xl font-semibold", outlook.fiadoTotal ? "text-success" : "text-muted-foreground")}>
                    {outlook.fiadoTotal ? "+" : ""}
                    {money(outlook.fiadoTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground">{outlook.fiadoCount} {outlook.fiadoCount === 1 ? "cliente" : "clientes"}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" /> Pagos a proveedores
                  </p>
                  <p className={cn("tabular mt-1 text-xl font-semibold", outlook.payablesTotal ? "text-danger" : "text-muted-foreground")}>
                    {outlook.payablesTotal ? "−" : ""}
                    {money(outlook.payablesTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground">{outlook.payables.length} por vencer o atrasados</p>
                </div>
                <div className="rounded-xl border bg-muted/40 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Wallet className="size-3.5" /> Si cobras y pagas todo
                  </p>
                  <p className={cn("tabular mt-1 text-xl font-semibold", outlook.fiadoTotal - outlook.payablesTotal < 0 && "text-danger")}>
                    {outlook.fiadoTotal - outlook.payablesTotal >= 0 ? "+" : "−"}
                    {money(Math.abs(outlook.fiadoTotal - outlook.payablesTotal))}
                  </p>
                  <p className="text-xs text-muted-foreground">Sumado a lo que hoy tienes en caja.</p>
                </div>
              </div>
              {outlook.payables.length ? (
                <ul className="divide-y rounded-xl border px-3 text-sm">
                  {outlook.payables.slice(0, 8).map((p) => {
                    const days = daysUntil(p.dueDate, now, ctx.timezone)
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block truncate">{p.description}</span>
                          <span className={cn("text-xs", days < 0 ? "text-danger" : "text-muted-foreground")}>
                            {p.supplier?.name ? `${p.supplier.name} · ` : ""}
                            {days < 0 ? `Atrasado ${-days} ${days === -1 ? "día" : "días"}` : days === 0 ? "Vence hoy" : `Vence en ${days} ${days === 1 ? "día" : "días"}`}
                          </span>
                        </span>
                        <span className="tabular shrink-0 font-medium">{money(p.amount)}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No tienes pagos a proveedores anotados.{" "}
                  <Link href="/dashboard/proveedores#pagos" className="text-primary hover:underline">
                    Anota tus facturas por pagar
                  </Link>{" "}
                  para verlos aquí.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <ProUpsell
            title="Mira lo que viene con Pro"
            text="Cuánto fiado tienes por cobrar, qué pagos a proveedores vencen en los próximos 30 días y cómo quedaría tu caja."
          />
        )
      ) : null}

      <Explainer title="¿En qué se diferencia de la utilidad?">
        El flujo de caja es la plata que de verdad entró y salió. La utilidad (en Resultados) es lo que ganaste: puede que
        hayas ganado plata pero tengas poca en caja, por ejemplo si vendiste mucho fiado o compraste mercadería que todavía
        no vendes.
      </Explainer>
    </div>
  )
}
