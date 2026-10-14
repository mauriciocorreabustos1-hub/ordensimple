import { cn } from "@/lib/utils"

type Part = { label: string; value: string; sub?: React.ReactNode }

/**
 * "La cuenta" del Inicio y Reportes, escrita como se hace a mano: los montos en una columna alineada a la
 * derecha, el gasto con su signo menos, la raya bajo los números y el resultado debajo. Al lado de cada línea,
 * su nota (cuántas ventas, comparación con el período anterior).
 * Si no hay nada anotado, muestra `empty` en vez de una cuenta de ceros.
 */
export function AccountLine({
  sales,
  expenses,
  result,
  positive,
  empty,
  size = "default",
}: {
  sales: Part
  expenses: Part
  result: Part
  /** Ganancia (verde) o pérdida (rojo). */
  positive: boolean
  /** Texto para cuando no hay ventas ni gastos. */
  empty?: string | null
  size?: "default" | "lg"
}) {
  if (empty) {
    return <p className="rounded-2xl border border-dashed bg-card px-5 py-4 text-sm text-muted-foreground">{empty}</p>
  }
  const amount = size === "lg" ? "text-2xl md:text-3xl" : "text-xl md:text-2xl"
  return (
    <div className="rounded-2xl border bg-card px-5 py-4 shadow-xs md:px-6 md:py-5">
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 sm:grid-cols-[9rem_auto_minmax(0,1fr)] sm:gap-x-8">
        <Row part={sales} amount={amount} />
        <Row part={expenses} amount={amount} minus />
        <Row
          part={result}
          amount={size === "lg" ? "text-3xl md:text-4xl" : "text-2xl md:text-[2rem]"}
          total
          tone={positive ? "text-success" : "text-danger"}
        />
      </dl>
    </div>
  )
}

function Row({
  part,
  amount,
  minus = false,
  total = false,
  tone,
}: {
  part: Part
  amount: string
  minus?: boolean
  total?: boolean
  tone?: string
}) {
  return (
    <>
      <dt className={cn("py-1.5 text-sm", total ? "pt-3 font-semibold" : "text-muted-foreground")}>
        {part.label}
        {/* En el celular solo el resultado lleva su nota (bajo la etiqueta), para no recargar la cuenta;
            en pantallas grandes cada línea tiene la suya en su propia columna. */}
        {total && part.sub ? <div className="mt-1 text-xs font-normal text-muted-foreground sm:hidden">{part.sub}</div> : null}
      </dt>
      <dd
        className={cn(
          "tabular py-1.5 text-right font-semibold tracking-tight whitespace-nowrap",
          amount,
          // La raya de la suma, solo bajo la columna de los montos.
          total && "mt-1 border-t-2 border-foreground/70 pt-3",
          tone,
        )}
      >
        {minus ? <span className="mr-1 font-normal text-muted-foreground">−</span> : null}
        {part.value}
      </dd>
      <dd className={cn("hidden py-1.5 text-xs text-muted-foreground sm:block", total && "pt-3")}>{part.sub}</dd>
    </>
  )
}
