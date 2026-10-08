import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight, HandCoins, Receipt, ShoppingBag } from "lucide-react"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/app/stat-card"
import { CashClosingForm } from "@/components/cash/cash-closing-form"
import { PAYMENT_METHODS } from "@/lib/constants"
import { formatMoney, formatNumber } from "@/lib/currency"
import { addDays, dateKeyToUtc, formatDate, toDateKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { getCashDay } from "@/server/queries/cash"
import { trackFeature } from "@/server/feature-usage"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Cierre de caja" }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function CashPage({ searchParams }: PageProps<"/dashboard/caja">) {
  const ctx = await requireBusiness()
  trackFeature(ctx.businessId, ctx.timezone, "caja")
  const params = await searchParams
  const today = toDateKey(new Date(), ctx.timezone)
  const requested = typeof params.dia === "string" && DATE_RE.test(params.dia) ? params.dia : today
  const day = requested > today ? today : requested
  const d = await getCashDay(ctx.businessId, ctx.timezone, day)
  const money = (n: number) => formatMoney(n, ctx.currency)

  const dayDate = dateKeyToUtc(day, ctx.timezone)
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
          {day === today ? "Hoy · " : ""}
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

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard compactOnMobile label="Ventas del día" value={money(d.salesTotal)} icon={ShoppingBag} tone="sales"
          hint={`${formatNumber(d.salesCount)} ${d.salesCount === 1 ? "venta" : "ventas"}`} />
        <StatCard compactOnMobile label="Abonos de fiado" value={money(d.paymentsTotal)} icon={HandCoins} tone="profit"
          hint="Lo que te pagaron clientes que te debían." />
        <StatCard compactOnMobile label="Gastos del día" value={money(d.expensesTotal)} icon={Receipt} tone="expenses"
          hint={`${formatNumber(d.expensesCount)} ${d.expensesCount === 1 ? "gasto" : "gastos"}`} />
      </div>

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
                      <span className="block text-xs text-muted-foreground">No entra plata hoy: queda como deuda del cliente.</span>
                    ) : null}
                  </span>
                  <span className={cn("tabular font-medium", !r.total && "text-muted-foreground")}>{money(r.total)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 pt-3 text-base font-semibold">
                <span>Total vendido</span>
                <span className="tabular">{money(d.salesTotal)}</span>
              </li>
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
                  <Link href={`/dashboard/caja?dia=${h.day}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary">
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
