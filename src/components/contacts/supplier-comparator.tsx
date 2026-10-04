"use client"

import * as React from "react"
import { Trophy } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { Explainer } from "@/components/app/explainer"
import { formatMoney, formatNumber } from "@/lib/currency"
import { cn } from "@/lib/utils"

type Option = { name: string; price: number; delivery: number }

/** Compara dos proveedores según cuántas unidades compras: precio × cantidad + despacho. */
export function SupplierComparator({
  currency,
  suppliers,
}: {
  currency: string
  suppliers: { name: string; deliveryCost: number | null }[]
}) {
  const money = (n: number) => formatMoney(n, currency)
  const [qty, setQty] = React.useState("20")
  const [a, setA] = React.useState<Option>({
    name: suppliers[0]?.name ?? "Proveedor A",
    price: 0,
    delivery: suppliers[0]?.deliveryCost ?? 0,
  })
  const [b, setB] = React.useState<Option>({
    name: suppliers[1]?.name ?? "Proveedor B",
    price: 0,
    delivery: suppliers[1]?.deliveryCost ?? 0,
  })

  const q = Number(qty) || 0
  const totalA = a.price * q + a.delivery
  const totalB = b.price * q + b.delivery
  const ready = a.price > 0 && b.price > 0 && q > 0
  const winner = !ready || totalA === totalB ? null : totalA < totalB ? a : b
  const savings = Math.abs(totalA - totalB)

  // Cantidad desde la que cambia el proveedor conveniente.
  let breakEven: number | null = null
  if (a.price !== b.price) {
    const x = (b.delivery - a.delivery) / (a.price - b.price)
    if (x > 0 && Number.isFinite(x)) breakEven = Math.ceil(x)
  }
  const cheaperUnit = a.price < b.price ? a : b
  const otherUnit = cheaperUnit === a ? b : a

  const column = (o: Option, setO: (o: Option) => void, total: number, label: string) => (
    <div
      className={cn(
        "space-y-3 rounded-xl border p-4",
        winner === o && "border-success/50 bg-success/5 ring-1 ring-success/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Input
          value={o.name}
          onChange={(e) => setO({ ...o, name: e.target.value })}
          list="comparator-suppliers"
          aria-label={`Nombre ${label}`}
          className="h-9 font-medium"
        />
        {winner === o ? <Trophy className="size-5 shrink-0 text-success" aria-label="Conviene" /> : null}
      </div>
      <Field label="Precio por unidad">
        <MoneyInput value={o.price} onValueChange={(price) => setO({ ...o, price })} currency={currency} aria-label={`Precio ${label}`} />
      </Field>
      <Field label="Despacho">
        <MoneyInput value={o.delivery} onValueChange={(delivery) => setO({ ...o, delivery })} currency={currency} aria-label={`Despacho ${label}`} />
      </Field>
      <div className="flex items-baseline justify-between border-t pt-3">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="tabular text-xl font-semibold">{ready ? money(total) : "—"}</span>
      </div>
    </div>
  )

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
        <div className="grid gap-3 sm:grid-cols-2">
          {column(a, setA, totalA, "proveedor A")}
          {column(b, setB, totalB, "proveedor B")}
        </div>
        {ready ? (
          <Explainer title={winner ? `Te conviene ${winner.name}` : "Te sale igual con los dos"}>
            {winner
              ? `Comprando ${formatNumber(q)} unidades ahorras ${money(savings)} con ${winner.name}.`
              : `Con ${formatNumber(q)} unidades pagas lo mismo con ambos.`}
            {breakEven !== null
              ? ` Ojo: desde ${formatNumber(breakEven)} unidades conviene ${cheaperUnit.name} (más barato por unidad); con menos, conviene ${otherUnit.name}.`
              : ""}
          </Explainer>
        ) : (
          <p className="text-sm text-muted-foreground">Ingresa el precio por unidad de ambos proveedores para comparar.</p>
        )}
      </CardContent>
    </Card>
  )
}
