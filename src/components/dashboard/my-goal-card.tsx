import { Target } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatMoney } from "@/lib/currency"

/** Para quien tiene meta o comisión: cuánto lleva vendido en el mes y cuánto le falta. */
export function MyGoalCard({
  net,
  goal,
  commission,
  rate,
  currency,
  month,
  daysLeft,
}: {
  net: number
  goal: number | null
  commission: number
  rate: number | null
  currency: string
  month: string
  daysLeft: number
}) {
  const money = (n: number) => formatMoney(n, currency)
  const pct = goal ? Math.min(1, Math.max(0, net / goal)) : 0
  const missing = goal ? Math.max(0, goal - net) : 0
  const done = Boolean(goal) && missing === 0
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Target className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Tus ventas de {month}</p>
            <p className="tabular text-2xl font-semibold">
              {money(net)}
              {goal ? <span className="text-base font-medium text-muted-foreground"> de {money(goal)}</span> : null}
            </p>
          </div>
        </div>
        {goal ? (
          <>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de tu meta">
              <div className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pct * 100}%` }} />
            </div>
            <p className="text-sm">
              {done ? (
                <span className="font-medium text-emerald-700 dark:text-emerald-400">¡Cumpliste tu meta del mes! 🎉</span>
              ) : (
                <>
                  Llevas el <span className="font-medium">{Math.round(pct * 100)}%</span>. Te faltan{" "}
                  <span className="tabular font-medium">{money(missing)}</span>
                  {daysLeft > 0 ? ` en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}` : ""}.
                </>
              )}
            </p>
          </>
        ) : null}
        {rate ? (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            Tu comisión va en <span className="tabular font-semibold">{money(commission)}</span>
            <span className="text-muted-foreground"> ({(Math.round(rate * 1000) / 10).toString().replace(".", ",")} % de lo que vendiste)</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
