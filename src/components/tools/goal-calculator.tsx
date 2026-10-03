"use client"

import * as React from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { Explainer } from "@/components/app/explainer"
import { MiniStat } from "@/components/tools/tool-shell"
import { PercentInput } from "@/components/tools/percent-input"
import { salesForGoal } from "@/lib/calculations"
import { formatMoney, formatPercent, referenceAmount } from "@/lib/currency"
import { saveGoal } from "@/server/actions/goals"

export function GoalCalculator({
  currency,
  canSave,
  monthSales,
  monthLabel,
  daysInMonth,
  dayOfMonth,
  defaults,
}: {
  currency: string
  canSave: boolean
  monthSales: number
  monthLabel: string
  daysInMonth: number
  dayOfMonth: number
  defaults: { targetProfit: number; marginPct: number; fixedCosts: number; marginFromData: boolean }
}) {
  const [targetProfit, setTargetProfit] = React.useState(defaults.targetProfit)
  const [marginPct, setMarginPct] = React.useState(defaults.marginPct)
  const [fixedCosts, setFixedCosts] = React.useState(defaults.fixedCosts)
  const [pending, startTransition] = React.useTransition()
  const money = (n: number) => formatMoney(n, currency)

  const result = salesForGoal(targetProfit, fixedCosts, marginPct, daysInMonth)
  const progress = result.ok && result.monthly > 0 ? Math.min(1, monthSales / result.monthly) : 0
  const remaining = result.ok ? Math.max(0, result.monthly - monthSales) : 0
  const daysLeft = Math.max(1, daysInMonth - dayOfMonth + 1)

  function save() {
    startTransition(async () => {
      const r = await saveGoal({ targetProfit, marginPct, fixedCosts })
      if (r.ok) toast.success("Meta guardada para este mes")
      else toast.error(r.message)
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="grid gap-5">
          <Field label="¿Cuánto quieres ganar este mes?" hint="Lo que te quieres llevar después de pagar todo.">
            <MoneyInput value={targetProfit} onValueChange={setTargetProfit} currency={currency} size="lg" aria-label="Ganancia deseada" />
          </Field>
          <Field label="Gastos fijos del mes" hint="Arriendo, sueldos, cuentas… lo que pagas aunque no vendas.">
            <MoneyInput value={fixedCosts} onValueChange={setFixedCosts} currency={currency} aria-label="Gastos fijos" />
          </Field>
          <Field
            label="¿Cuánto te queda de cada venta?"
            hint={
              defaults.marginFromData
                ? "Calculado con tus productos. Es lo que queda después de pagar la mercadería."
                : `Si vendes a ${money(referenceAmount(currency))} algo que te costó ${money(referenceAmount(currency) * 0.7)}, te queda 30%.`
            }
          >
            <PercentInput value={marginPct} onChange={setMarginPct} min={1} max={100} label="Margen" />
          </Field>
          {canSave ? (
            <Button variant="outline" onClick={save} disabled={pending || targetProfit <= 0}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              Guardar como meta de {monthLabel}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {result.ok && targetProfit > 0 ? (
          <>
            <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
              <p className="text-sm text-primary-foreground/80">Necesitas vender al mes</p>
              <p className="tabular text-4xl font-semibold tracking-tight">{money(result.monthly)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Por semana" value={money(result.weekly)} />
              <MiniStat label="Por día" value={money(result.daily)} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cómo vas en {monthLabel}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={progress * 100} className="h-3" aria-label="Avance de la meta" />
                <div className="flex justify-between text-sm">
                  <span className="tabular font-medium">{money(monthSales)}</span>
                  <span className="text-muted-foreground">{formatPercent(progress, 0)} de la meta</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {remaining > 0
                    ? `Te faltan ${money(remaining)}. Para llegar, necesitas vender unos ${money(Math.ceil(remaining / daysLeft))} diarios los ${daysLeft} días que quedan.`
                    : "¡Ya alcanzaste las ventas necesarias para tu meta este mes!"}
                </p>
              </CardContent>
            </Card>
            <Explainer title="¿Cómo lo calculamos?">
              Para ganar {money(targetProfit)} primero tienes que cubrir {money(fixedCosts)} de gastos fijos. Como de
              cada venta te queda el {marginPct}%, necesitas vender {money(result.monthly)} para juntar ambos montos.
            </Explainer>
          </>
        ) : (
          <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Escribe cuánto quieres ganar y te diremos cuánto necesitas vender.
          </div>
        )}
      </div>
    </div>
  )
}
