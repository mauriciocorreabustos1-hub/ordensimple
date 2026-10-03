import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { formatPercent } from "@/lib/currency"
import { cn } from "@/lib/utils"

type Tone = "default" | "sales" | "expenses" | "profit" | "loss"

const toneStyles: Record<Tone, string> = {
  default: "bg-muted text-foreground",
  sales: "bg-chart-1/15 text-chart-1",
  expenses: "bg-chart-2/15 text-chart-2",
  profit: "bg-chart-3/15 text-chart-3",
  loss: "bg-danger/15 text-danger",
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  change,
  changeLabel,
  invertChange = false,
  size = "default",
  compactOnMobile = false,
  className,
}: {
  label: string
  value: string
  icon?: LucideIcon
  tone?: Tone
  hint?: React.ReactNode
  /** Variación como razón (0.15 = +15%). null = sin datos para comparar. */
  change?: number | null
  changeLabel?: string
  /** Para gastos: subir es malo. */
  invertChange?: boolean
  size?: "default" | "lg"
  /** En celular: una sola fila (etiqueta a la izquierda, monto a la derecha). */
  compactOnMobile?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs md:p-5",
        compactOnMobile && "max-sm:flex-row max-sm:flex-wrap max-sm:items-center max-sm:justify-between max-sm:gap-x-3 max-sm:gap-y-1 max-sm:py-3",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", toneStyles[tone])}>
            <Icon className="size-4" />
          </span>
        ) : null}
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div
        className={cn(
          "tabular font-semibold tracking-tight",
          size === "lg" ? "text-3xl md:text-4xl" : "text-2xl md:text-[1.7rem]",
          compactOnMobile && "max-sm:text-xl",
          tone === "loss" && "text-danger",
        )}
      >
        {value}
      </div>
      {change !== undefined ? <ChangeBadge change={change} label={changeLabel} invert={invertChange} /> : null}
      {hint ? (
        <p className={cn("text-xs leading-relaxed text-muted-foreground", compactOnMobile && "max-sm:basis-full")}>{hint}</p>
      ) : null}
    </div>
  )
}

/** Diferencia en dinero (para ganancias, donde el % confunde si hay pérdidas). */
export function DiffBadge({
  current,
  previous,
  money,
  label,
}: {
  current: number
  previous: number
  money: (n: number) => string
  label?: string
}) {
  const diff = current - previous
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "tabular inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
          diff > 0 && "bg-success/15 text-success",
          diff < 0 && "bg-danger/15 text-danger",
          diff === 0 && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-3" />
        {money(Math.abs(diff))}
      </span>
      {diff > 0 ? "más" : diff < 0 ? "menos" : "igual"} {label}
    </span>
  )
}

export function ChangeBadge({
  change,
  label,
  invert = false,
}: {
  change: number | null
  label?: string
  invert?: boolean
}) {
  if (change === null) {
    return <span className="text-xs text-muted-foreground">Sin datos para comparar {label}</span>
  }
  const up = change > 0.005
  const down = change < -0.005
  const good = invert ? down : up
  const bad = invert ? up : down
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
          good && "bg-success/15 text-success",
          bad && "bg-danger/15 text-danger",
          !good && !bad && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-3" />
        {formatPercent(Math.abs(change), 0)}
      </span>
      {label}
    </span>
  )
}
