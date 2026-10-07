"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts"
import { formatMoney } from "@/lib/currency"

export type ChartPoint = { key: string; label: string; fullLabel: string; sales: number; expenses: number }

/** Nombres de las dos series y del resultado (se pueden cambiar, por ejemplo a "Entradas" y "Salidas"). */
export type ChartLabels = { sales: string; expenses: string; gain: string; loss: string }
const DEFAULT_LABELS: ChartLabels = { sales: "Ventas", expenses: "Gastos", gain: "Te quedó", loss: "Perdiste" }

const series = (l: ChartLabels) =>
  [
    { key: "sales", label: l.sales, color: "var(--chart-1)" },
    { key: "expenses", label: l.expenses, color: "var(--chart-2)" },
  ] as const

function ChartTooltip({ active, payload, currency, labels }: TooltipContentProps<number, string> & { currency: string; labels: ChartLabels }) {
  if (!active || !payload?.length) return null
  const SERIES = series(labels)
  const point = payload[0].payload as ChartPoint
  const diff = point.sales - point.expenses
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground first-letter:uppercase">{point.fullLabel}</p>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
          <span className="tabular font-medium text-foreground">{formatMoney(point[s.key], currency)}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t pt-1.5">
        <span className="text-muted-foreground">{diff >= 0 ? labels.gain : labels.loss}</span>
        <span className="tabular font-semibold text-foreground">{formatMoney(Math.abs(diff), currency)}</span>
      </div>
    </div>
  )
}

/** Barras agrupadas de ventas vs gastos. Incluye leyenda y una tabla accesible con los mismos datos. */
export function SalesExpensesChart({
  data,
  currency,
  height = 240,
  caption,
  labels = DEFAULT_LABELS,
}: {
  data: ChartPoint[]
  currency: string
  height?: number
  caption: string
  labels?: ChartLabels
}) {
  const SERIES = series(labels)
  if (data.every((d) => d.sales === 0 && d.expenses === 0)) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-center text-sm text-muted-foreground"
        style={{ height }}
      >
        <p className="font-medium text-foreground">Aún no hay movimientos en este período</p>
        <p>Cuando registres ventas o gastos, aquí verás cómo se comparan.</p>
      </div>
    )
  }
  return (
    <figure className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              interval={data.length > 14 ? "preserveStartEnd" : 0}
              minTickGap={6}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={(props) => <ChartTooltip {...(props as TooltipContentProps<number, string>)} currency={currency} labels={labels} />}
            />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <details className="group text-xs">
        <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">Ver como tabla</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Período</th>
              <th className="py-1 text-right font-medium">{labels.sales}</th>
              <th className="py-1 text-right font-medium">{labels.expenses}</th>
              <th className="py-1 text-right font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {data.map((d) => (
              <tr key={d.key} className="border-t">
                <td className="py-1 first-letter:uppercase">{d.fullLabel}</td>
                <td className="py-1 text-right">{formatMoney(d.sales, currency)}</td>
                <td className="py-1 text-right">{formatMoney(d.expenses, currency)}</td>
                <td className="py-1 text-right">{formatMoney(d.sales - d.expenses, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
