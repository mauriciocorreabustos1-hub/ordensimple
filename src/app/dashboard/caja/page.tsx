import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight, HandCoins, Receipt, ShoppingBag } from "lucide-react"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/app/page-header"
import { StatCard, STAT_GROUP } from "@/components/app/stat-card"
import { CashClosingForm } from "@/components/cash/cash-closing-form"
import { PAYMENT_METHODS } from "@/lib/constants"
import { formatMoney, formatNumber } from "@/lib/currency"
import { addDays, dateKeyToUtc, formatDate, toDateKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { getCashDay, getShifts } from "@/server/queries/cash"
import { ShiftPanel } from "@/components/cash/shift-panel"
import { trackFeature } from "@/server/feature-usage"
import { ProGate } from "@/components/app/pro-gate"
import { canUseFeature } from "@/lib/plans"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Cierre de caja" }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function CashPage({ searchParams }: PageProps<"/dashboard/caja">) {
  const ctx = await requireBusiness()
  if (!canUseFeature(ctx.business.plan, "cashClose")) {
    return <ProGate title="Cierre de caja" description="Cuenta el dinero al final del día y mira si cuadra con lo que vendiste." />
  }
  trackFeature(ctx.businessId, ctx.timezone, "caja")
  const params = await searchParams
  const today = toDateKey(new Date(), ctx.timezone)
  const requested = typeof params.dia === "string" && DATE_RE.test(params.dia) ? params.dia : today
  const day = requested > today ? today : requested
  const dayDate = dateKeyToUtc(day, ctx.timezone)
  const [d, shifts] = await Promise.all([
    getCashDay(ctx.businessId, ctx.timezone, day),
    getShifts(ctx.businessId, dayDate, addDays(dayDate, 1, ctx.timezone)),
  ])
  const money = (n: number) => formatMoney(n, ctx.currency)

  const prevDay = toDateKey(addDays(dayDate, -1, ctx.timezone), ctx.timezone)
  const nextDay = toDateKey(addDays(dayDate, 1, ctx.timezone), ctx.timezone)
  const dayLabel = formatDate(dayDate, ctx.timezone, { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  const rows = PAYMENT_METHODS.map((m) => ({ ...m, ...(d.salesBy[m.value as PaymentMethod] ?? { total: 0, count: 0 }) }))
  const summaryLines = rows.filter((r) => r.total > 0).map((r) => `• ${r.label}: ${money(r.total)}`)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cierre de caja"
        description="Al final del día, revisa cuánto vendiste por cada medio de pago y cuadra el efectivo."
      />

      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/caja?dia=${prevDay}`} aria-label="Día anterior">
            <ChevronLeft />
          </Link>
        </Button>
        <p className="text-center font-medium first-letter:uppercase">
          {day === today ? "Hoy, " : ""}
          {dayLabel}
        </p>
        <Button variant="ghost" size="icon" asChild disabled={day >= today}>
          <Link
            href={`/dashboard/caja?dia=${nextDay}`}
            aria-label="Día siguiente"
            className={cn(day >= today && "pointer-events-none opacity-30")}
          >
            <ChevronRight />
          </Link>
        </Button>
      </div>

      <div className={`grid gap-3 sm:grid-cols-3 ${STAT_GROUP}`}>
        <StatCard
          compactOnMobile
          label="Ventas del día"
          value={money(d.salesTotal)}
          icon={ShoppingBag}
          tone="sales"
          hint={`${formatNumber(d.salesCount)} ${d.salesCount === 1 ? "venta" : "ventas"}`}
        />
        <StatCard
          compactOnMobile
          label="Abonos de fiado"
          value={money(d.paymentsTotal)}
          icon={HandCoins}
          tone="profit"
          hint="Lo que te pagaron clientes que te debían."
        />
        <StatCard
          compactOnMobile
          label="Gastos del día"
          value={money(d.expensesTotal)}
          icon={Receipt}
          tone="expenses"
          hint={`${formatNumber(d.expensesCount)} ${d.expensesCount === 1 ? "gasto" : "gastos"}`}
        />
      </div>

      <ShiftPanel
        isToday={day === today}
        currency={ctx.currency}
        timezone={ctx.timezone}
        lastCounted={shifts.lastCounted}
        open={
          shifts.open && shifts.openWindow
            ? {
                id: shifts.open.id,
                openedBy: shifts.open.openedBy?.name ?? "Alguien del equipo",
                openedAt: shifts.open.openedAt.toISOString(),
                opening: shifts.open.opening,
                ...shifts.openWindow,
              }
            : null
        }
        shifts={shifts.day.map((s) => ({
          id: s.id,
          openedBy: s.openedBy?.name ?? "Alguien del equipo",
          closedBy: s.closedBy?.name ?? "Alguien del equipo",
          openedAt: s.openedAt.toISOString(),
          closedAt: s.closedAt!.toISOString(),
          salesTotal: s.salesTotal,
          expected: s.expected,
          counted: s.counted ?? 0,
          difference: s.difference ?? 0,
          note: s.note,
        }))}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>¿Cómo te pagaron hoy?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.value} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    {r.label}
                    {r.count ? <span className="text-muted-foreground"> · {r.count}</span> : null}
                    {r.value === "FIADO" && r.total ? (
                      <span className="block text-xs text-muted-foreground">No entra dinero hoy: queda como deuda del cliente.</span>
                    ) : null}
                  </span>
                  <span className={cn("tabular font-medium", !r.total && "text-muted-foreground")}>{money(r.total)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 pt-3 text-base font-semibold">
                <span>Total vendido</span>
                <span className="tabular">{money(d.salesTotal)}</span>
              </li>
              {d.tipsTotal ? (
                <li className="flex items-center justify-between gap-3 pt-2 text-sm">
                  <span>
                    Propinas
                    <span className="block text-xs text-muted-foreground">
                      Aparte de las ventas: son para el equipo.{d.tipsCash ? ` ${money(d.tipsCash)} quedaron en efectivo en la caja.` : ""}
                    </span>
                  </span>
                  <span className="tabular font-medium">{money(d.tipsTotal)}</span>
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <CashClosingForm
          key={day}
          day={day}
          dayLabel={dayLabel}
          businessName={ctx.business.name}
          currency={ctx.currency}
          cashSales={d.cashSales}
          cashPayments={d.cashPayments}
          expensesTotal={d.expensesTotal}
          withdrawalsCash={d.withdrawalsCash}
          depositsCash={d.depositsCash}
          tipsCash={d.tipsCash}
          salesTotal={d.salesTotal}
          summaryLines={summaryLines}
          initial={
            d.closing
              ? {
                  opening: d.closing.opening,
                  counted: d.closing.counted,
                  expensesFromCash: d.closing.cashOut > 0,
                  note: d.closing.note ?? "",
                }
              : undefined
          }
        />
      </div>

      {d.history.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Cierres anteriores</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {d.history.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/dashboard/caja?dia=${h.day}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary"
                  >
                    <span className="first-letter:uppercase">
                      {formatDate(dateKeyToUtc(h.day, ctx.timezone), ctx.timezone, { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="tabular text-muted-foreground">Contado {money(h.counted)}</span>
                      <span
                        className={cn(
                          "tabular rounded-full px-2 py-0.5 text-xs font-medium",
                          h.difference === 0 ? "bg-success/15 text-success" : "bg-warning/15 text-foreground",
                        )}
                      >
                        {h.difference === 0 ? "Cuadró" : h.difference > 0 ? `+${money(h.difference)}` : `−${money(-h.difference)}`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
