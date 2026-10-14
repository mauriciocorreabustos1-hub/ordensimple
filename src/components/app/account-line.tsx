import { cn } from "@/lib/utils"

type Part = { label: string; value: string; sub?: React.ReactNode }

/**
 * "La cuenta" del Inicio: Vendiste − Gastaste = Te quedó, con la operación a la vista (como se haría en el
 * cuaderno), en vez de tres tarjetas sueltas. En el celular queda como una suma escrita: una línea bajo otra,
 * la raya y el resultado.
 */
export function AccountLine({
  sales,
  expenses,
  result,
  positive,
  size = "default",
}: {
  sales: Part
  expenses: Part
  result: Part
  /** Ganancia (verde) o pérdida (rojo). */
  positive: boolean
  size?: "default" | "lg"
}) {
  const big = size === "lg" ? "text-3xl md:text-4xl" : "text-2xl md:text-[1.75rem]"
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="grid sm:grid-cols-[1fr_auto_1fr_auto_1.15fr]">
        <Cell part={sales} big={big} />
        <Op>−</Op>
        <Cell part={expenses} big={big} op="−" />
        <Op>=</Op>
        <Cell
          part={result}
          big={big}
          op="="
          className="max-sm:border-t-2 max-sm:border-t-foreground/70 sm:border-l sm:bg-muted/40"
          valueClassName={positive ? "text-success" : "text-danger"}
          strong
        />
      </div>
    </div>
  )
}

function Op({ children }: { children: React.ReactNode }) {
  return (
    <span className="hidden self-start px-1 pt-[2.6rem] font-sans text-3xl leading-none font-light text-muted-foreground/70 sm:block md:pt-[3.05rem]" aria-hidden>
      {children}
    </span>
  )
}

function Cell({
  part,
  big,
  op,
  className,
  valueClassName,
  strong = false,
}: {
  part: Part
  big: string
  /** En el celular, el signo va antes de la etiqueta. */
  op?: string
  className?: string
  valueClassName?: string
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 p-4 md:p-5",
        "max-sm:flex-row max-sm:flex-wrap max-sm:items-baseline max-sm:justify-between max-sm:gap-x-3 max-sm:gap-y-0.5 max-sm:py-3",
        className,
      )}
    >
      <span className={cn("text-sm text-muted-foreground", strong && "font-medium text-foreground")}>
        {op ? (
          <span className="mr-1.5 font-semibold text-muted-foreground sm:hidden" aria-hidden>
            {op}
          </span>
        ) : null}
        {part.label}
      </span>
      <span className={cn("tabular font-semibold tracking-tight max-sm:text-xl", big, valueClassName)}>{part.value}</span>
      {part.sub ? <div className="text-xs leading-relaxed text-muted-foreground max-sm:basis-full">{part.sub}</div> : null}
    </div>
  )
}
