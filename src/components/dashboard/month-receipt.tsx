import { CountUp } from "@/components/app/count-up"
import { PrintIn } from "@/components/app/print-in"
import { cn } from "@/lib/utils"

type Line = {
  label: string
  value: string
  note?: React.ReactNode
  minus?: boolean
}

/**
 * "La cuenta del mes" del Inicio, impresa como una boleta: lo vendido y lo gastado con puntos guía hasta el
 * monto, la raya, lo que quedó en grande y, al pie, la explicación en palabras simples. Es el mismo papel de la
 * boleta de la página de inicio, para que por dentro OrdenSimple se vea igual que por fuera.
 */
export function MonthReceipt({
  title,
  subtitle,
  lines,
  result,
  positive,
  footnote,
  empty,
  className,
}: {
  title: string
  subtitle: string
  lines: Line[]
  result: Line
  /** Ganancia (verde) o pérdida (rojo). */
  positive: boolean
  footnote?: React.ReactNode
  /** Texto para cuando no hay nada anotado: la boleta sale en blanco con este mensaje. */
  empty?: string | null
  className?: string
}) {
  return (
    <section
      aria-labelledby="mes"
      className={cn("drop-shadow-[0_10px_24px_rgb(0_40_30/0.10)]", className)}
    >
      <PrintIn>
        <div className="receipt-edge bg-[#fbfaf6] px-5 pt-6 pb-11 text-[#13201c] sm:px-8 dark:bg-card dark:text-foreground">
          <header className="space-y-0.5 text-center font-mono">
            <h2 id="mes" className="text-base font-semibold">
              {title}
            </h2>
            <p className="text-xs text-[#5b6b66] dark:text-muted-foreground">
              {subtitle}
            </p>
          </header>

          {empty ? (
            <p className="mt-5 border-t border-dashed border-current/25 pt-5 text-center text-sm text-pretty text-[#5b6b66] dark:text-muted-foreground">
              {empty}
            </p>
          ) : (
            <>
              <div className="mt-5 space-y-4 border-y border-dashed border-current/25 py-5">
                {lines.map((l) => (
                  <div key={l.label} className="space-y-1">
                    <p className="flex items-baseline font-mono text-[15px] sm:text-base">
                      <span>{l.label}</span>
                      <span
                        aria-hidden
                        className="mx-2 min-w-6 flex-1 -translate-y-[3px] border-b border-dotted border-current/30"
                      />
                      <span className="tabular font-semibold whitespace-nowrap">
                        {l.minus ? "−" : null}
                        <CountUp value={l.value} />
                      </span>
                    </p>
                    {l.note ? (
                      <div className="flex justify-end text-xs">{l.note}</div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 pt-5">
                <p className="flex flex-wrap items-baseline justify-between gap-x-4 font-mono">
                  <span className="text-lg font-semibold">{result.label}</span>
                  <span
                    className={cn(
                      "tabular text-4xl font-semibold tracking-tight sm:text-5xl",
                      positive ? "text-success" : "text-danger",
                    )}
                  >
                    <CountUp value={result.value} duration={1200} />
                  </span>
                </p>
                {result.note ? (
                  <div className="flex justify-end text-xs">{result.note}</div>
                ) : null}
              </div>
            </>
          )}

          {footnote ? (
            <p className="mt-6 border-t border-dashed border-current/25 pt-4 text-sm text-pretty text-[#3d4d48] dark:text-muted-foreground">
              {footnote}
            </p>
          ) : null}
        </div>
      </PrintIn>
    </section>
  )
}
