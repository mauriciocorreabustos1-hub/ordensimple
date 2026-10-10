"use client"

import * as React from "react"
import { Plus, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { Explainer } from "@/components/app/explainer"
import { formatMoney, formatNumber } from "@/lib/currency"
import { cn } from "@/lib/utils"

type Option = { key: number; name: string; price: number; delivery: number }

const MAX = 6
const LETTERS = "ABCDEF"
let optionKey = 0

/** Compara proveedores (2 a 6) según cuántas unidades compras: precio × cantidad + despacho. */
export function SupplierComparator({
  currency,
  suppliers,
}: {
  currency: string
  suppliers: { name: string; deliveryCost: number | null }[]
}) {
  const money = (n: number) => formatMoney(n, currency)
  const [qty, setQty] = React.useState("20")
  const [options, setOptions] = React.useState<Option[]>(() =>
    [0, 1].map((i) => ({
      key: ++optionKey,
      name: suppliers[i]?.name ?? `Proveedor ${LETTERS[i]}`,
      price: 0,
      delivery: suppliers[i]?.deliveryCost ?? 0,
    })),
  )

  const update = (key: number, patch: Partial<Option>) => setOptions((os) => os.map((o) => (o.key === key ? { ...o, ...patch } : o)))
  function add() {
    setOptions((os) => {
      // Sugiere el siguiente proveedor guardado que aún no está en la comparación.
      const next = suppliers.find((s) => !os.some((o) => o.name === s.name))
      return [
        ...os,
        {
          key: ++optionKey,
          name: next?.name ?? `Proveedor ${LETTERS[os.length] ?? os.length + 1}`,
          price: 0,
          delivery: next?.deliveryCost ?? 0,
        },
      ]
    })
  }

  const q = Number(qty) || 0
  const total = (o: Option) => o.price * q + o.delivery
  const filled = options.filter((o) => o.price > 0)
  const ready = filled.length >= 2 && q > 0
  const ranked = [...filled].sort((x, y) => total(x) - total(y))
  const best = ready ? ranked[0] : null
  const second = ready ? ranked[1] : null
  const tie = best && second && total(best) === total(second)
  const winner = tie ? null : best

  // Si el más barato por unidad no es el que conviene ahora, desde cuántas unidades pasa a convenir.
  const cheapestUnit = filled.length ? filled.reduce((m, o) => (o.price < m.price ? o : m)) : null
  let breakEven: number | null = null
  if (winner && cheapestUnit && cheapestUnit !== winner && cheapestUnit.price < winner.price) {
    const x = (cheapestUnit.delivery - winner.delivery) / (winner.price - cheapestUnit.price)
    if (x > 0 && Number.isFinite(x)) breakEven = Math.ceil(x + 1e-9)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>¿Qué proveedor me conviene?</CardTitle>
        <CardDescription>Compara precio y despacho según cuántas unidades vas a comprar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <datalist id="comparator-suppliers">
          {suppliers.map((s) => (
            <option key={s.name} value={s.name} />
          ))}
        </datalist>
        <Field label="¿Cuántas unidades vas a comprar?" htmlFor="cmp-qty">
          <Input
            id="cmp-qty"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
            className="tabular h-10 max-w-40"
          />
        </Field>
        {/* Columnas de al menos 13rem: si no caben (por ejemplo en la columna angosta de Proveedores), bajan a otra fila. */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-3">
          {options.map((o, i) => {
            const label = `proveedor ${LETTERS[i] ?? i + 1}`
            const isWinner = winner === o
            return (
              <div
                key={o.key}
                className={cn("space-y-3 rounded-xl border p-4", isWinner && "border-success/50 bg-success/5 ring-1 ring-success/40")}
              >
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={o.name}
                    onChange={(e) => update(o.key, { name: e.target.value })}
                    list="comparator-suppliers"
                    aria-label={`Nombre ${label}`}
                    className="h-9 min-w-0 font-medium [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  {isWinner ? <Trophy className="size-5 shrink-0 text-success" aria-label="Conviene" /> : null}
                  {options.length > 2 ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground"
                      onClick={() => setOptions((os) => os.filter((x) => x.key !== o.key))}
                      aria-label={`Quitar ${o.name || label}`}
                    >
                      <X />
                    </Button>
                  ) : null}
                </div>
                <Field label="Precio por unidad">
                  <MoneyInput
                    value={o.price}
                    onValueChange={(price) => update(o.key, { price })}
                    currency={currency}
                    aria-label={`Precio ${label}`}
                  />
                </Field>
                <Field label="Despacho">
                  <MoneyInput
                    value={o.delivery}
                    onValueChange={(delivery) => update(o.key, { delivery })}
                    currency={currency}
                    aria-label={`Despacho ${label}`}
                  />
                </Field>
                <div className="space-y-0.5 border-t pt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="tabular text-xl font-semibold">{o.price > 0 && q > 0 ? money(total(o)) : "—"}</span>
                  </div>
                  {o.price > 0 && q > 0 ? (
                    <p className="tabular text-right text-xs text-muted-foreground">
                      {money(Math.round(total(o) / q))} por unidad con despacho
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })}
          {options.length < MAX ? (
            <button
              type="button"
              onClick={add}
              className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 hover:text-primary"
            >
              <Plus className="size-5" />
              Agregar proveedor
            </button>
          ) : null}
        </div>
        {ready && best && second ? (
          <Explainer title={winner ? `Te conviene ${winner.name}` : `Te sale igual con ${best.name} y ${second.name}`}>
            {winner
              ? `Comprando ${formatNumber(q)} unidades pagas ${money(total(winner))}: ahorras ${money(total(second) - total(winner))} frente a ${second.name}${
                  ranked.length > 2
                    ? ` y ${money(total(ranked[ranked.length - 1]) - total(winner))} frente al más caro (${ranked[ranked.length - 1].name})`
                    : ""
                }.`
              : `Con ${formatNumber(q)} unidades pagas ${money(total(best))} con cualquiera de los dos.`}
            {breakEven !== null && cheapestUnit
              ? ` Ojo: si compras ${formatNumber(breakEven)} unidades o más, conviene ${cheapestUnit.name} (más barato por unidad).`
              : ""}
          </Explainer>
        ) : (
          <p className="text-sm text-muted-foreground">Ingresa el precio por unidad de al menos dos proveedores para comparar.</p>
        )}
      </CardContent>
    </Card>
  )
}
