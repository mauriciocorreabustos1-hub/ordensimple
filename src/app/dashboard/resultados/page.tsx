import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Download, Landmark, Package, PiggyBank, Receipt, ShoppingBag, TrendingDown, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Explainer } from "@/components/app/explainer"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { StatCard } from "@/components/app/stat-card"
import { VatCoverage } from "@/components/results/vat-coverage"
import { formatMoney, formatPercent } from "@/lib/currency"
import { formatDate, startOfMonth, zonedParts, zonedTimeToUtc } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { db } from "@/lib/db"
import { can } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { daysUntil, formatDueDate, ppmAmount, vatDueDate, vatInfo } from "@/lib/vat"
import { getIncomeStatement, getYearSummary } from "@/server/queries/results"
import { trackFeature } from "@/server/feature-usage"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "Resultados e IVA" }

const MONTH_RE = /^(\d{4})-(\d{2})$/
const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`

/** Una línea del estado de resultados. */
function Line({
  label,
  value,
  money,
  kind = "line",
  hint,
}: {
  label: React.ReactNode
  value: number
  money: (n: number) => string
  kind?: "line" | "minus" | "detail" | "subtotal" | "total"
  hint?: React.ReactNode
}) {
  const strong = kind === "subtotal" || kind === "total"
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 py-2.5",
        kind === "detail" && "py-1.5 pl-6 text-muted-foreground",
        kind === "subtotal" && "border-t font-semibold",
        kind === "total" && "mt-1 rounded-xl bg-muted/60 px-3 py-3 text-base font-semibold",
      )}
    >
      <div className="min-w-0">
        <p className={cn("text-sm", strong && "text-base", kind === "detail" && "text-xs")}>{label}</p>
        {hint ? <p className="text-xs font-normal text-muted-foreground">{hint}</p> : null}
      </div>
      <p
        className={cn(
          "tabular shrink-0",
          kind === "detail" ? "text-xs" : "text-sm",
          strong && "text-base",
          kind === "total" && (value >= 0 ? "text-success" : "text-danger"),
        )}
      >
        {kind === "minus" || kind === "detail" ? `− ${money(value)}` : value < 0 ? `− ${money(-value)}` : money(value)}
      </p>
    </div>
  )
}

export default async function ResultsPage({ searchParams }: PageProps<"/dashboard/resultados">) {
  const ctx = await requireBusiness()
  requirePermission(ctx, "reports:view")
  if (!canUseFeature(ctx.business.plan, "results")) {
    return <ProGate title="Resultados e IVA" description="Tu estado de resultados, tu utilidad y el IVA que te toca pagar." />
  }

  const now = new Date()
  const today = zonedParts(now, ctx.timezone)
  const params = await searchParams
  const match = MONTH_RE.exec(String(params.mes ?? ""))
  let year = match ? Number(match[1]) : today.year
  let month = match ? Number(match[2]) : today.month
  // No se puede mirar meses futuros.
  if (month < 1 || month > 12 || year * 12 + month > today.year * 12 + today.month || year < 2000) {
    year = today.year
    month = today.month
  }

  const vat = vatInfo(ctx.business.country)
  trackFeature(ctx.businessId, ctx.timezone, "resultados")
  const chargesVat = Boolean(vat && ctx.settings.chargesVat)
  const rate = chargesVat ? vat!.rate : null
  const L = vat?.label ?? "IVA"

  const from = zonedTimeToUtc(year, month, 1, ctx.timezone)
  const to = startOfMonth(from, ctx.timezone, 1)
  const lastMonth = year === today.year ? today.month : 12

  const [{ statement: st, categories, salesCount, raw }, { rows, totals }, withdrawn] = await Promise.all([
    getIncomeStatement(ctx.businessId, from, to, rate),
    getYearSummary(ctx.businessId, year, lastMonth, ctx.timezone, rate),
    canUseFeature(ctx.business.plan, "balance")
      ? db.ownerWithdrawal.aggregate({ where: { businessId: ctx.businessId, date: { gte: from, lt: to }, kind: { not: "DEPOSIT" } }, _sum: { amount: true } })
      : Promise.resolve(null),
  ])
  const withdrawnTotal = withdrawn?._sum.amount ?? 0
  const money = (n: number) => formatMoney(n, ctx.currency)
  const monthText = formatDate(from, ctx.timezone, { month: "long", year: "numeric" })
  const monthLabel = monthText.charAt(0).toUpperCase() + monthText.slice(1)
  const isCurrent = year === today.year && month === today.month

  const current = rows[month - 1]
  // Si anotó el pago del IVA o del PPM como gasto, se estaría restando dos veces.
  const taxes = chargesVat ? categories.find((c) => /impuesto/i.test(c.name) && c.total > 0) : undefined
  // Los meses vacíos antes de empezar a registrar no se muestran (el mes elegido siempre aparece).
  const firstActive = rows.findIndex((r) => r.s.sales !== 0 || r.s.costOfSales !== 0 || r.s.operatingExpenses !== 0 || r.s.purchasesToInventory !== 0)
  const visibleRows = rows.slice(Math.min(firstActive < 0 ? month - 1 : firstActive, month - 1))
  const due = vatDueDate(year, month, ctx.settings.vatDueDay, ctx.timezone, ctx.business.country)
  // PPM: va en el mismo F29 que el IVA (solo Chile), sobre las ventas sin IVA.
  const ppmRate = chargesVat && ctx.business.country === "CL" ? ctx.settings.ppmRate : 0
  const ppm = ppmAmount(st.netSales, ppmRate)
  const f29 = current.vatToPay + ppm
  const ppmLabel = `PPM (${(ppmRate * 100).toLocaleString("es-CL", { maximumFractionDigits: 3 })}% de tus ventas sin ${L})`
  const left = daysUntil(due, now, ctx.timezone)

  const prev = month === 1 ? key(year - 1, 12) : key(year, month - 1)
  const next = month === 12 ? key(year + 1, 1) : key(year, month + 1)
  const salesLabel = chargesVat ? `Ventas sin ${L}` : "Ventas"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resultados e IVA"
        description="Cuánto vendiste, cuánto te costó lo que vendiste y cuánto ganaste de verdad."
        actions={
          <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between">
            <Button variant="outline" size="icon" asChild>
              <Link href={`/dashboard/resultados?mes=${prev}`} aria-label="Mes anterior">
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
                <Link href={`/dashboard/resultados?mes=${next}`} aria-label="Mes siguiente">
                  <ChevronRight />
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard compactOnMobile label={salesLabel} value={money(st.netSales)} icon={ShoppingBag} tone="sales"
          hint={salesCount === 1 ? "1 venta" : `${salesCount} ventas`} />
        <StatCard compactOnMobile label="Costo de venta" value={money(st.costOfSales)} icon={Package} tone="expenses" />
        <StatCard compactOnMobile label="Gastos" value={money(st.operatingExpenses)} icon={Receipt} tone="expenses" />
        <StatCard
          compactOnMobile
          label={st.profit >= 0 ? "Utilidad" : "Pérdida"}
          value={money(Math.abs(st.profit))}
          icon={st.profit >= 0 ? PiggyBank : TrendingDown}
          tone={st.profit >= 0 ? "profit" : "loss"}
          hint={st.margin !== null && st.profit > 0 ? `Te quedó el ${formatPercent(st.margin, 0)} de lo vendido` : undefined}
        />
      </div>

      {withdrawnTotal ? (
        <Link
          href="/dashboard/balance"
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors hover:bg-accent/40",
            st.profit - withdrawnTotal < 0 ? "border-danger/40 bg-danger/5" : "bg-card",
          )}
        >
          <Wallet className="size-4 shrink-0 text-primary" />
          <span className="flex-1">
            Este mes te llevaste <strong className="tabular">{money(withdrawnTotal)}</strong> (retiros del dueño, no son gasto).{" "}
            {st.profit - withdrawnTotal >= 0
              ? `Quedaron ${money(st.profit - withdrawnTotal)} de la ganancia en el negocio.`
              : `Es ${money(withdrawnTotal - st.profit)} más de lo que ganó el negocio.`}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      {chargesVat ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-5 text-primary" />
              {`${L} de ${formatDate(from, ctx.timezone, { month: "long" })}`}
            </CardTitle>
            <CardDescription>
              {f29 > 0 ? (
                <>
                  Pagas hasta el <strong className="text-foreground">{formatDueDate(due, ctx.timezone)}</strong>
                  {vat!.form ? ` (${vat!.form})` : ""}
                  {left > 0 ? ` · faltan ${left} ${left === 1 ? "día" : "días"}` : left === 0 ? " · vence hoy" : " · ya venció"}
                  {isCurrent ? ". El monto puede cambiar hasta que termine el mes." : "."}
                </>
              ) : st.vat.debit === 0 && st.vat.credit === 0 ? (
                "Todavía no hay ventas ni gastos con factura este mes. Igual tienes que presentar el F29 (sin movimiento)."
              ) : (
                `Este mes no te toca pagar: lo que puedes descontar es mayor que el ${L} de tus ventas.`
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-[1fr_1.4fr] md:items-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  {f29 > 0 ? (ppm > 0 ? "Total a pagar en el F29 (aprox.)" : `${L} a pagar (aprox.)`) : `${L} a favor para el mes siguiente`}
                </p>
                <p className={cn("tabular text-4xl font-semibold tracking-tight", f29 > 0 ? "text-foreground" : "text-success")}>
                  {money(f29 > 0 ? f29 : current.carryOut)}
                </p>
                {f29 > 0 && current.carryOut > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">Y te quedan {money(current.carryOut)} de {L} a favor para el mes siguiente.</p>
                ) : null}
              </div>
              <div className="divide-y rounded-xl border px-4">
                <Line money={money} label={`${L} de tus ventas`} hint="Lo que va dentro de tus precios" value={st.vat.debit} />
                <Line money={money} kind="minus" label={`${L} de tus gastos con factura`} hint="Lo que puedes descontar" value={st.vat.credit} />
                {current.carryIn > 0 ? (
                  <Line money={money} kind="minus" label="A favor del mes anterior" value={current.carryIn} />
                ) : null}
                <Line money={money} kind="subtotal" label={current.vatToPay > 0 || current.carryOut === 0 ? `${L} a pagar` : `${L} a favor`} value={current.vatToPay > 0 || current.carryOut === 0 ? current.vatToPay : current.carryOut} />
                {ppm > 0 ? (
                  <>
                    <Line money={money} label={ppmLabel} hint="Pago provisional del impuesto a la renta" value={ppm} />
                    <Line money={money} kind="subtotal" label="Total F29" value={f29} />
                  </>
                ) : null}
              </div>
            </div>
            <VatCoverage
              label={L}
              chile={ctx.business.country === "CL"}
              ppm={ppmRate > 0 ? `${(ppmRate * 100).toLocaleString("es-CL", { maximumFractionDigits: 3 })}%` : null}
            />
          </CardContent>
        </Card>
      ) : vat && can(ctx.role, "settings:manage") ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <Landmark className="size-4 text-primary" />
            ¿Tu negocio cobra {L}? Actívalo y te diremos cuánto pagar cada mes y hasta qué día.
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/configuracion">Activar {L}</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Estado de resultados</CardTitle>
            <CardDescription>
              {monthLabel}
              {isCurrent ? ", hasta hoy" : ""}
              {chargesVat ? ` · montos sin ${L}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              {chargesVat ? (
                <>
                  <Line money={money} label="Ventas totales" hint="Lo que te pagaron tus clientes" value={st.sales} />
                  <Line money={money} kind="minus" label={`${L} de las ventas`} hint="No es tuyo: se paga al SII" value={st.salesVat} />
                  <Line money={money} kind="subtotal" label={`Ventas sin ${L}`} value={st.netSales} />
                </>
              ) : (
                <Line money={money} kind="subtotal" label="Ventas" hint="Lo que te pagaron tus clientes" value={st.netSales} />
              )}
              <Line
                money={money}
                kind="minus"
                label="Costo de venta"
                hint={
                  st.costMethod === "products"
                    ? `Lo que te costaron los productos que vendiste${st.estimatedCost > 0 ? ` (${money(st.estimatedCost)} estimado para ventas sin detalle)` : ""}`
                    : st.costMethod === "purchases"
                      ? "Tus compras de mercadería del mes"
                      : "Sin datos: agrega el costo a tus productos o registra tus compras"
                }
                value={st.costOfSales}
              />
              <Line
                money={money}
                kind="subtotal"
                label="Utilidad bruta"
                hint={st.grossMargin !== null ? `Margen de ${formatPercent(st.grossMargin, 0)} sobre lo vendido` : undefined}
                value={st.grossProfit}
              />
              <Line money={money} kind="minus" label="Gastos del negocio" hint="Arriendo, sueldos, cuentas y otros" value={st.operatingExpenses} />
              {categories
                .filter((c) => !c.isVariable && c.total > 0)
                .map((c) => (
                  <Line key={c.name} money={money} kind="detail" label={c.name} value={c.total} />
                ))}
              {st.waste > 0 ? (
                <Line money={money} kind="minus" label="Merma y vencidos" hint="Productos vencidos, dañados o perdidos, a costo" value={st.waste} />
              ) : null}
              <Line
                money={money}
                kind="total"
                label={st.profit >= 0 ? "Utilidad del mes" : "Pérdida del mes"}
                hint="Antes del impuesto a la renta"
                value={st.profit}
              />
              {taxes ? (
                <p className="mt-3 rounded-lg bg-warning/10 p-3 text-xs text-foreground">
                  En “{taxes.name}” tienes {money(taxes.total)}. Si ahí anotaste el pago del {L} o del PPM, no son gastos del
                  negocio: el {L} ya lo calculamos aparte y el PPM es un adelanto del impuesto a la renta. Cámbialos de
                  categoría o elimínalos para que tu utilidad sea correcta.
                </p>
              ) : null}
              {st.purchasesToInventory > 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Compraste {money(st.purchasesToInventory)} en mercadería{chargesVat && raw.purchasesInvoiced > 0 ? ` (sin el ${L} de las facturas)` : ""}. No se resta aquí porque ya contamos el costo de
                  lo que vendiste; lo que no vendiste sigue en tu inventario.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Explainer title="En palabras simples">
            {st.netSales > 0 ? (
              <>
                De cada {money(10_000)} que vendiste{chargesVat ? ` (sin ${L})` : ""}, {money(Math.round((st.costOfSales / st.netSales) * 10_000))} se fueron en
                el costo de lo que vendiste, {money(Math.round(((st.operatingExpenses + st.waste) / st.netSales) * 10_000))} en los gastos del negocio{st.waste > 0 ? " y la merma" : ""} y{" "}
                {st.profit >= 0 ? (
                  <>te quedaron {money(Math.round((st.profit / st.netSales) * 10_000))} de utilidad.</>
                ) : (
                  <>no alcanzó: perdiste {money(Math.round((-st.profit / st.netSales) * 10_000))}.</>
                )}
              </>
            ) : (
              "Cuando registres ventas este mes, aquí verás de dónde sale tu utilidad."
            )}
          </Explainer>
          <div className="space-y-2 rounded-xl border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="text-sm font-medium text-foreground">¿Cómo lo calculamos?</p>
            <p>
              <strong>Utilidad bruta</strong> = ventas − costo de venta. Es lo que te dejan tus productos.{" "}
              <strong>Utilidad del mes</strong> = utilidad bruta − gastos del negocio.
            </p>
            {chargesVat ? (
              <p>
                Con {L}, los montos se muestran sin {L}: el {L} de tus ventas no es ganancia, se paga al SII, y el de tus
                gastos con factura lo recuperas. El {L} de lo que compras sin factura no se recupera, así que es parte de tu
                costo. Suponemos que tus precios y el costo de tus productos incluyen {L}.
              </p>
            ) : null}
            {chargesVat ? <p>Qué incluye y qué no el cálculo del {L}: está explicado en la tarjeta del {L}, más arriba.</p> : null}
            <p>Es un cálculo aproximado para ordenarte. Para tu declaración, la cifra oficial la revisa tu contador o el SII.</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>Resumen de {year}</CardTitle>
            <CardDescription>Mes a mes, con la suma del año.{chargesVat ? ` Montos sin ${L}.` : ""}</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={`/dashboard/resultados/exportar?anio=${year}`}>
              <Download />
              Descargar (Excel)
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Mes</th>
                  <th className="py-2 pr-3 text-right font-medium">Ventas</th>
                  <th className="py-2 pr-3 text-right font-medium">Costo de venta</th>
                  <th className="py-2 pr-3 text-right font-medium">Utilidad bruta</th>
                  <th className="py-2 pr-3 text-right font-medium">Gastos</th>
                  <th className="py-2 pr-3 text-right font-medium">Utilidad</th>
                  {chargesVat ? <th className="py-2 pr-3 text-right font-medium">{L} a pagar</th> : null}
                  {ppmRate > 0 ? <th className="py-2 text-right font-medium">PPM</th> : null}
                </tr>
              </thead>
              <tbody className="tabular">
                {visibleRows.map((r) => (
                  <tr key={r.month} className={cn("border-b last:border-0", r.month === month && "bg-accent/50")}>
                    <td className="py-2 pr-3 capitalize">
                      <Link href={`/dashboard/resultados?mes=${key(year, r.month)}`} className="hover:text-primary hover:underline">
                        {formatDate(zonedTimeToUtc(year, r.month, 1, ctx.timezone), ctx.timezone, { month: "long" })}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-right">{money(r.s.netSales)}</td>
                    <td className="py-2 pr-3 text-right">{money(r.s.costOfSales)}</td>
                    <td className="py-2 pr-3 text-right">{money(r.s.grossProfit)}</td>
                    <td className="py-2 pr-3 text-right">{money(r.s.operatingExpenses + r.s.waste)}</td>
                    <td className={cn("py-2 pr-3 text-right font-medium", r.s.profit < 0 && "text-danger")}>{money(r.s.profit)}</td>
                    {chargesVat ? <td className="py-2 pr-3 text-right">{money(r.vatToPay)}</td> : null}
                    {ppmRate > 0 ? <td className="py-2 text-right">{money(ppmAmount(r.s.netSales, ppmRate))}</td> : null}
                  </tr>
                ))}
              </tbody>
              <tfoot className="tabular">
                <tr className="border-t-2 font-semibold">
                  <td className="py-3 pr-3">Total {year}</td>
                  <td className="py-3 pr-3 text-right">{money(totals.netSales)}</td>
                  <td className="py-3 pr-3 text-right">{money(totals.costOfSales)}</td>
                  <td className="py-3 pr-3 text-right">{money(totals.grossProfit)}</td>
                  <td className="py-3 pr-3 text-right">{money(totals.operatingExpenses)}</td>
                  <td className={cn("py-3 pr-3 text-right", totals.profit < 0 ? "text-danger" : "text-success")}>{money(totals.profit)}</td>
                  {chargesVat ? <td className="py-3 pr-3 text-right">{money(totals.vatToPay)}</td> : null}
                  {ppmRate > 0 ? <td className="py-3 text-right">{money(rows.reduce((acc, r) => acc + ppmAmount(r.s.netSales, ppmRate), 0))}</td> : null}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
