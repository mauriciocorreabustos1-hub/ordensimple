"use client"

import * as React from "react"
import { CheckCircle2, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"

export type DemoItem = { name: string; price: number }

const METHODS = ["Efectivo", "Débito", "Crédito", "Transferencia"] as const

/**
 * Venta de ejemplo para aprender: todo pasa en esta pantalla. No llama al servidor ni guarda nada, así que no toca
 * el inventario, la caja, los reportes ni el historial de ventas.
 */
export function SaleDemo({ items, currency, onDone }: { items: DemoItem[]; currency: string; onDone: () => void }) {
  const [picked, setPicked] = React.useState<number | null>(null)
  const [qty, setQty] = React.useState(1)
  const [method, setMethod] = React.useState<(typeof METHODS)[number] | null>(null)
  const money = (n: number) => formatMoney(n, currency)
  const item = picked === null ? null : items[picked]
  const total = item ? item.price * qty : 0
  // Qué falta para poder guardar: se ilumina el paso que sigue.
  const current = item === null ? 1 : method === null ? 3 : 4

  const stepTitle = (n: number, text: string) => (
    <p className={cn("flex items-center gap-2 text-sm font-medium", current === n ? "text-foreground" : "text-muted-foreground")}>
      <span
        className={cn(
          "tabular flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          current > n || (n === 2 && item) ? "bg-success/15 text-success" : current === n ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {current > n || (n === 2 && item) ? "✓" : n}
      </span>
      {text}
    </p>
  )

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-dashed border-warning/50 bg-warning/10 px-3 py-2 text-sm">
        Esto es un ejemplo para practicar: <strong>no se guarda</strong> ni cambia tu inventario, tu caja ni tus reportes.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-5">
          <div className="space-y-2.5">
            {stepTitle(1, "Elige el producto que vendiste")}
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Producto de ejemplo">
              {items.map((it, i) => (
                <button
                  key={it.name}
                  type="button"
                  role="radio"
                  aria-checked={picked === i}
                  onClick={() => {
                    setPicked(i)
                    setQty(1)
                  }}
                  className={cn(
                    "rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    picked === i && "border-primary bg-accent ring-1 ring-primary",
                  )}
                >
                  <span className="block text-sm font-medium">{it.name}</span>
                  <span className="tabular block text-sm text-muted-foreground">{money(it.price)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {stepTitle(2, "Indica la cantidad")}
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="icon" aria-label="Uno menos" disabled={!item || qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                <Minus />
              </Button>
              <span className="tabular w-10 text-center text-xl font-semibold" aria-live="polite">
                {qty}
              </span>
              <Button type="button" variant="outline" size="icon" aria-label="Uno más" disabled={!item || qty >= 20} onClick={() => setQty((q) => Math.min(20, q + 1))}>
                <Plus />
              </Button>
            </div>
          </div>

          <div className="space-y-2.5">
            {stepTitle(3, "Elige cómo te pagaron")}
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Medio de pago de ejemplo">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  disabled={!item}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "min-h-10 rounded-full border bg-card px-4 text-sm transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50",
                    method === m && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border bg-muted/40 p-4 lg:self-start">
          {stepTitle(4, "Revisa el total y guarda")}
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{item ? `${qty} × ${item.name}` : "Sin producto"}</dt>
              <dd className="tabular">{item ? money(item.price * qty) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Pago</dt>
              <dd>{method ?? "—"}</dd>
            </div>
          </dl>
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="font-medium">Total</span>
            <span className="tabular font-display text-2xl font-semibold" aria-live="polite">
              {money(total)}
            </span>
          </div>
          <Button type="button" size="lg" className="h-11 w-full" disabled={!item || !method} onClick={onDone}>
            <CheckCircle2 />
            Guardar venta de ejemplo
          </Button>
        </div>
      </div>
    </div>
  )
}
