"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { Explainer } from "@/components/app/explainer"
import { MiniStat, ResultBox } from "@/components/tools/tool-shell"
import { breakEven } from "@/lib/calculations"
import { formatMoney, formatNumber } from "@/lib/currency"

export function BreakEvenCalculator({
  currency,
  defaults,
}: {
  currency: string
  defaults: { fixedCosts: number; unitCost: number; price: number; fromData: boolean }
}) {
  const [fixedCosts, setFixedCosts] = React.useState(defaults.fixedCosts)
  const [unitCost, setUnitCost] = React.useState(defaults.unitCost)
  const [price, setPrice] = React.useState(defaults.price)
  const money = (n: number) => formatMoney(n, currency)
  const result = breakEven(fixedCosts, unitCost, price)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="grid gap-5">
          <Field
            label="Gastos fijos del mes"
            hint={
              defaults.fromData
                ? "Usamos tus gastos de los últimos 30 días, sin contar compras de mercadería. Puedes cambiarlo."
                : "Arriendo, sueldos, luz, internet… lo que pagas aunque no vendas."
            }
          >
            <MoneyInput value={fixedCosts} onValueChange={setFixedCosts} currency={currency} aria-label="Gastos fijos" />
          </Field>
          <Field label="¿Cuánto te cuesta cada producto?">
            <MoneyInput value={unitCost} onValueChange={setUnitCost} currency={currency} aria-label="Costo por producto" />
          </Field>
          <Field label="¿A cuánto lo vendes?">
            <MoneyInput value={price} onValueChange={setPrice} currency={currency} aria-label="Precio de venta" />
          </Field>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {result.ok && fixedCosts > 0 ? (
          <>
            <ResultBox
              label="Necesitas vender"
              value={`${formatNumber(result.units)} unidades`}
              sub={`Eso equivale a ${money(result.salesAmount)} en ventas este mes`}
            />
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Ganas por unidad" value={money(result.unitContribution)} />
              <MiniStat label="Por día (30 días)" value={`${formatNumber(Math.ceil(result.units / 30))} unidades`} />
            </div>
            <Explainer title="En palabras simples">
              Necesitas vender aproximadamente {formatNumber(result.units)} unidades este mes para cubrir todos tus
              gastos. Desde la venta {formatNumber(result.units + 1)} empiezas a generar ganancia: cada unidad extra te
              deja unos {money(result.unitContribution)}.
            </Explainer>
          </>
        ) : !result.ok && result.reason === "price-below-cost" ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-sm">
            <p className="font-medium">Con este precio nunca llegarás al equilibrio</p>
            <p className="mt-1 text-foreground/80">
              El producto te cuesta lo mismo o más de lo que lo vendes. Cada venta te hace perder plata. Sube el precio o
              busca un proveedor más barato.
            </p>
          </div>
        ) : (
          <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Completa tus gastos fijos, el costo y el precio para ver cuánto necesitas vender.
          </div>
        )}
        <Explainer title="¿Qué es el punto de equilibrio?">
          Es la cantidad que tienes que vender para no ganar ni perder. Por debajo de ese número estás perdiendo plata;
          por encima, empiezas a ganar.
        </Explainer>
      </div>
    </div>
  )
}
