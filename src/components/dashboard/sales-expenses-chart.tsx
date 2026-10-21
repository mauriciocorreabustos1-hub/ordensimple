"use client"

import dynamic from "next/dynamic"
import { formatMoney } from "@/lib/currency"

export type ChartPoint = { key: string; label: string; fullLabel: string; sales: number; expenses: number }

/** Nombres de las dos series y del resultado (se pueden cambiar, por ejemplo a "Entradas" y "Salidas"). */
export type ChartLabels = { sales: string; expenses: string; gain: string; loss: string }
const DEFAULT_LABELS: ChartLabels = { sales: "Ventas", expenses: "Gastos", gain: "Te quedó", loss: "Perdiste" }

export const chartSeries = (l: ChartLabels) =>
  [
    { key: "sales", label: l.sales, color: "var(--chart-1)" },
    { key: "expenses", label: l.expenses, color: "var(--chart-2)" },
  ] as const

// Las barras usan recharts (~100 KB): se cargan después de mostrar la página, en el mismo espacio (no se mueve nada).
const SalesExpensesBars = dynamic(() => import("@/components/dashboard/sales-expenses-bars").then((m) => m.SalesExpensesBars), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-lg bg-muted/50" />,
})

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
  const SERIES = chartSeries(labels)
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
        <SalesExpensesBars data={data} currency={currency} labels={labels} />
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
