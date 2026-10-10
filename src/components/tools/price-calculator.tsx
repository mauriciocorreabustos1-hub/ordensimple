"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { Explainer } from "@/components/app/explainer"
import { MiniStat, ResultBox } from "@/components/tools/tool-shell"
import { PercentInput } from "@/components/tools/percent-input"
import { priceForMargin } from "@/lib/calculations"
import { formatMoney, formatPercent } from "@/lib/currency"

type Extra = { key: number; name: string; amount: number }
let extraKey = 0
const SUGGESTIONS = ["Bolsa o envase", "Envío", "Comisión de la máquina de tarjetas", "Etiqueta", "Mano de obra"]

export function PriceCalculator({ currency }: { currency: string }) {
  const [cost, setCost] = React.useState(0)
  // Otros costos por unidad, cada uno con su nombre (bolsa, envío, comisión…).
  const [extras, setExtras] = React.useState<Extra[]>(() => [{ key: ++extraKey, name: "", amount: 0 }])
  const otherCosts = extras.reduce((t, e) => t + e.amount, 0)
  const updateExtra = (key: number, patch: Partial<Extra>) => setExtras((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const [margin, setMargin] = React.useState(30)
  const money = (n: number) => formatMoney(n, currency)

  const totalCost = cost + otherCosts
  const price = margin < 100 ? priceForMargin(totalCost, margin) : null
  const profit = price !== null ? price - totalCost : 0
  // Error común: sumar el % al costo en vez de calcular el margen sobre el precio.
  const naivePrice = Math.round(totalCost * (1 + margin / 100))
  const naiveMargin = naivePrice > 0 ? (naivePrice - totalCost) / naivePrice : 0

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="grid gap-5">
          <Field label="¿Cuánto te cuesta el producto?" hint="Lo que pagas al proveedor o lo que te cuesta fabricarlo.">
            <MoneyInput value={cost} onValueChange={setCost} currency={currency} aria-label="Costo del producto" autoFocus />
          </Field>
          <div className="grid gap-2">
            <p className="text-sm font-medium">
              Otros costos por unidad <span className="font-normal text-muted-foreground">(opcional)</span>
            </p>
            <datalist id="price-extra-names">
              {SUGGESTIONS.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {extras.map((x, i) => (
              <div key={x.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)_auto] items-center gap-2">
                <Input
                  value={x.name}
                  onChange={(e) => updateExtra(x.key, { name: e.target.value })}
                  list="price-extra-names"
                  placeholder={i === 0 ? "Ej.: bolsa, envío, comisión…" : "¿Qué otro costo?"}
                  aria-label={`Nombre del costo ${i + 1}`}
                  className="h-10 [&::-webkit-calendar-picker-indicator]:hidden"
                />
                <MoneyInput
                  value={x.amount}
                  onValueChange={(amount) => updateExtra(x.key, { amount })}
                  currency={currency}
                  aria-label={`Monto del costo ${i + 1}`}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={extras.length === 1 && !x.name && !x.amount}
                  onClick={() =>
                    setExtras((xs) => (xs.length === 1 ? [{ key: ++extraKey, name: "", amount: 0 }] : xs.filter((e) => e.key !== x.key)))
                  }
                  aria-label={`Quitar costo ${x.name || i + 1}`}
                >
                  <X />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {extras.length < 8 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExtras((xs) => [...xs, { key: ++extraKey, name: "", amount: 0 }])}
                >
                  <Plus />
                  Agregar otro costo
                </Button>
              ) : (
                <span />
              )}
              {extras.length > 1 && otherCosts > 0 ? (
                <span className="tabular text-sm text-muted-foreground">Suman {money(otherCosts)}</span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">Bolsa, envase, envío, comisión de la máquina de tarjetas…</p>
          </div>
          <Field label="¿Cuánto quieres ganar de cada venta?" hint="El porcentaje del precio final que quieres que te quede.">
            <PercentInput value={margin} onChange={setMargin} min={1} max={90} label="Margen deseado" />
          </Field>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {totalCost > 0 && price !== null ? (
          <>
            <ResultBox label="Precio sugerido" value={money(price)} sub={`Para ganar ${formatPercent(margin / 100, 0)} de cada venta`} />
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Te cuesta" value={money(totalCost)} />
              <MiniStat label="Ganas" value={money(profit)} />
              <MiniStat label="Margen" value={formatPercent(margin / 100, 0)} />
            </div>
            <Explainer title="En palabras simples">
              Si vendes a {money(price)}, de cada venta te quedan {money(profit)} después de pagar el producto. Con eso pagas arriendo,
              sueldos y otros gastos, y lo que sobra es tu ganancia.
            </Explainer>
            <Explainer title="Cuidado con este error común">
              Muchas personas suman el {margin}% al costo y venden a {money(naivePrice)}. Pero así solo ganan el{" "}
              {formatPercent(naiveMargin, 0)} del precio, no el {margin}%. Por eso el precio sugerido es un poco más alto.
            </Explainer>
          </>
        ) : (
          <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Ingresa cuánto te cuesta el producto y te diremos a cuánto venderlo.
          </div>
        )}
      </div>
    </div>
  )
}
