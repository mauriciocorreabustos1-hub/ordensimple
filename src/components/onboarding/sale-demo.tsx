"use client"

import * as React from "react"
import { CheckCircle2, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"

export type DemoItem = { name: string; price: number }

/** Los mismos medios de pago de una venta real, con lo que significa cada uno. */
const METHODS = [
  { label: "Efectivo", hint: "Billetes y monedas" },
  { label: "Débito", hint: "Tarjeta de débito" },
  { label: "Crédito", hint: "Tarjeta de crédito" },
  { label: "Transferencia", hint: "Transferencia bancaria" },
] as const
type Method = (typeof METHODS)[number]["label"]

/**
 * Venta de práctica, paso a paso: todo pasa en esta pantalla. No llama al servidor ni guarda nada, así que no toca
 * las ventas, el inventario, la caja, los gastos, los reportes ni el historial.
 */
export function SaleDemo({ items, currency, fiado, onDone }: { items: DemoItem[]; currency: string; fiado: boolean; onDone: () => void }) {
  const [picked, setPicked] = React.useState<number | null>(null)
  const [qty, setQty] = React.useState(1)
  const [qtyTouched, setQtyTouched] = React.useState(false)
  const [method, setMethod] = React.useState<Method | null>(null)
  const money = (n: number) => formatMoney(n, currency)
  const item = picked === null ? null : items[picked]
  const total = item ? item.price * qty : 0
  // El paso que se ilumina: lo que falta hacer. La cantidad no es obligatoria (parte en 1).
  const current = !item ? 1 : !method ? (qtyTouched ? 3 : 2) : 4
  const done = (n: number) =>
    n === 1 ? Boolean(item) : n === 2 ? Boolean(item) && (qtyTouched || Boolean(method)) : n === 3 ? Boolean(method) : false
  const missing = !item ? "Falta elegir el producto." : !method ? "Falta elegir cómo te pagaron." : null

  return (
    <div className="space-y-4">
      <div className="space-y-1 rounded-xl border border-dashed border-warning/50 bg-warning/10 px-4 py-3 text-sm text-pretty">
        <p>
          <strong>Esta es una venta de práctica.</strong> No se guarda ni cambia tus ventas, tu inventario, tu caja ni tus reportes.
        </p>
        <p className="text-muted-foreground">
          Cuando comiences a usar OrdenSimple podrás registrar ventas con los productos reales de tu negocio, y también escaneando su código de barras
          con la cámara del celular.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-2">
          <Step n={1} active={current === 1} isDone={done(1)} title="Elige el producto que vendiste" hint="Toca uno de estos productos de ejemplo.">
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Producto de ejemplo">
              {items.map((it, i) => (
                <button
                  key={it.name}
                  type="button"
                  role="radio"
                  aria-checked={picked === i}
                  onClick={() => setPicked(i)}
                  className={cn(
                    "flex min-h-14 items-center justify-between gap-2 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:block",
                    picked === i && "border-primary bg-accent ring-1 ring-primary",
                  )}
                >
                  <span className="block text-sm font-medium">{it.name}</span>
                  <span className="tabular block text-sm text-muted-foreground">{money(it.price)}</span>
                </button>
              ))}
            </div>
          </Step>

          <Step
            n={2}
            active={current === 2}
            isDone={done(2)}
            title="Indica la cantidad"
            hint="Si vendiste más de uno, súmalos con el botón +. El total cambia solo."
          >
            <div className="flex items-center gap-3 pl-8">
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className={cn("size-11", current === 2 && "border-primary/60")}
                aria-label="Uno menos"
                disabled={qty <= 1}
                onClick={() => {
                  setQty((q) => Math.max(1, q - 1))
                  setQtyTouched(true)
                }}
              >
                <Minus />
              </Button>
              <span className="tabular w-10 text-center text-2xl font-semibold" aria-live="polite" aria-label={`Cantidad: ${qty}`}>
                {qty}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className={cn("size-11", current === 2 && "border-primary/60")}
                aria-label="Uno más"
                disabled={qty >= 20}
                onClick={() => {
                  setQty((q) => Math.min(20, q + 1))
                  setQtyTouched(true)
                }}
              >
                <Plus />
              </Button>
            </div>
          </Step>

          <Step
            n={3}
            active={current === 3}
            isDone={done(3)}
            title="Elige cómo te pagaron"
            hint="El mismo medio de pago que eliges en una venta real."
          >
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Medio de pago de ejemplo">
              {METHODS.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  role="radio"
                  aria-checked={method === m.label}
                  onClick={() => setMethod(m.label)}
                  className={cn(
                    "min-h-14 rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    method === m.label && "border-primary bg-primary text-primary-foreground hover:border-primary",
                  )}
                >
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className={cn("block text-xs", method === m.label ? "text-primary-foreground/80" : "text-muted-foreground")}>{m.hint}</span>
                </button>
              ))}
            </div>
            {fiado ? (
              <p className="text-xs text-pretty text-muted-foreground">
                ¿Te pagan después? Eso es <strong className="text-foreground">fiado</strong>, no tarjeta de crédito: en una venta real lo anotas a
                nombre del cliente y queda como lo que te debe.
              </p>
            ) : null}
          </Step>
        </div>

        <Step
          n={4}
          active={current === 4}
          isDone={done(4)}
          title="Revisa y finaliza"
          hint="Puedes cambiar cualquier dato antes de terminar."
          className="lg:sticky lg:top-6 lg:self-start"
        >
          <dl className="space-y-1.5 text-sm">
            {[
              ["Producto", item?.name ?? "—"],
              ["Cantidad", item ? String(qty) : "—"],
              ["Precio unitario", item ? money(item.price) : "—"],
              ["Pago", method ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="tabular text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="font-medium">Total</span>
            <span className="tabular font-display text-2xl font-semibold" aria-live="polite">
              {money(total)}
            </span>
          </div>
          <Button type="button" size="lg" className="h-12 w-full text-base" disabled={Boolean(missing)} onClick={() => !missing && onDone()}>
            <CheckCircle2 />
            Finalizar práctica
          </Button>
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            {missing ?? "No se guardará ninguna venta."}
          </p>
        </Step>
      </div>
    </div>
  )
}

/** Un paso de la práctica: se ilumina cuando es el que sigue. */
function Step({
  n,
  title,
  hint,
  children,
  className,
  active,
  isDone,
}: {
  n: number
  title: string
  hint: string
  children: React.ReactNode
  className?: string
  active: boolean
  isDone: boolean
}) {
  return (
    <section
      aria-labelledby={`practica-paso-${n}`}
      className={cn(
        "space-y-3 rounded-2xl border p-4 transition-[border-color,background-color,box-shadow] duration-300 motion-reduce:transition-none",
        active ? "border-primary/50 bg-accent/40 shadow-sm ring-1 ring-primary/20" : "border-transparent",
        className,
      )}
    >
      <div className="space-y-0.5">
        <h3 id={`practica-paso-${n}`} className="flex items-center gap-2 text-sm font-semibold">
          <span
            className={cn(
              "tabular flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
              isDone ? "bg-success/15 text-success" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {isDone ? "✓" : n}
          </span>
          {title}
          {isDone ? <span className="sr-only">(listo)</span> : null}
        </h3>
        <p className={cn("pl-8 text-sm text-pretty", active ? "text-foreground" : "text-muted-foreground")}>{hint}</p>
      </div>
      {children}
    </section>
  )
}
