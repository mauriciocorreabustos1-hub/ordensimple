import { QuickButtons } from "@/components/dashboard/quick-buttons"

/**
 * Lo primero del Inicio: cuánto te va quedando hoy y los dos botones que más se usan, juntos en el verde de la marca.
 * Si todavía no hay nada anotado, en vez de una cuenta de ceros muestra `empty`.
 */
export function TodayPanel({
  resultLabel,
  result,
  sales,
  salesNote,
  expenses,
  empty,
}: {
  resultLabel: string
  result: string
  sales: string
  salesNote: string
  expenses: string
  empty?: string | null
}) {
  return (
    <section aria-labelledby="hoy" data-tour="cuenta-hoy" className="grid gap-6 rounded-2xl bg-deep p-5 text-deep-foreground shadow-sm md:p-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
      <div className="min-w-0 space-y-1">
        <h2 id="hoy" className="text-sm font-medium text-deep-foreground/80">
          {empty ? "Hoy" : resultLabel}
        </h2>
        {empty ? (
          <p className="max-w-lg text-lg text-pretty">{empty}</p>
        ) : (
          <>
            <p className="tabular font-display text-5xl font-semibold tracking-tight md:text-6xl">{result}</p>
            <dl className="flex flex-wrap gap-x-8 gap-y-1 pt-3 text-sm">
              <div className="flex items-baseline gap-2">
                <dt className="text-deep-foreground/75">Vendiste</dt>
                <dd className="tabular font-semibold">
                  {sales} <span className="font-normal text-deep-foreground/75">({salesNote})</span>
                </dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-deep-foreground/75">Gastaste</dt>
                <dd className="tabular font-semibold">{expenses}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
      <QuickButtons onDark />
    </section>
  )
}
