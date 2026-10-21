"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts"
import { formatMoney } from "@/lib/currency"
import { chartSeries, type ChartLabels, type ChartPoint } from "@/components/dashboard/sales-expenses-chart"

// Va en un archivo aparte porque recharts pesa ~100 KB: se descarga después de mostrar la página.

function ChartTooltip({ active, payload, currency, labels }: TooltipContentProps<number, string> & { currency: string; labels: ChartLabels }) {
  if (!active || !payload?.length) return null
  const SERIES = chartSeries(labels)
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
/** Las barras del gráfico (se cargan aparte). */
export function SalesExpensesBars({ data, currency, labels }: { data: ChartPoint[]; currency: string; labels: ChartLabels }) {
  const SERIES = chartSeries(labels)
  return (
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
  )
}
