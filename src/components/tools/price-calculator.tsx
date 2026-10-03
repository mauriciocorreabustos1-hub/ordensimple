"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { Explainer } from "@/components/app/explainer"
import { MiniStat, ResultBox } from "@/components/tools/tool-shell"
import { PercentInput } from "@/components/tools/percent-input"
import { priceForMargin } from "@/lib/calculations"
import { formatMoney, formatPercent } from "@/lib/currency"

export function PriceCalculator({ currency }: { currency: string }) {
  const [cost, setCost] = React.useState(0)
  const [otherCosts, setOtherCosts] = React.useState(0)
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
          <Field label="Otros costos por unidad" optional hint="Bolsa, envase, envío, comisión de la máquina de tarjetas…">
            <MoneyInput value={otherCosts} onValueChange={setOtherCosts} currency={currency} aria-label="Otros costos" />
          </Field>
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
              Si vendes a {money(price)}, de cada venta te quedan {money(profit)} después de pagar el producto. Con eso
              pagas arriendo, sueldos y otros gastos, y lo que sobra es tu ganancia.
            </Explainer>
            <Explainer title="Cuidado con este error común">
              Muchas personas suman el {margin}% al costo y venden a {money(naivePrice)}. Pero así solo ganan el{" "}
              {formatPercent(naiveMargin, 0)} del precio, no el {margin}%. Por eso el precio sugerido es un poco más
              alto.
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
