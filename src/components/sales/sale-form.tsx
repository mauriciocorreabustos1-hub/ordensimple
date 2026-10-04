"use client"

import * as React from "react"
import { Loader2, Minus, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { PaymentChips } from "@/components/app/payment-chips"
import { formatMoney } from "@/lib/currency"
import { toDateKey } from "@/lib/dates"
import { createSale } from "@/server/actions/sales"

export type ProductOption = { id: string; name: string; price: number; stock: number; trackStock: boolean }

type Line = { key: number; productId: string; description: string; quantity: number; unitPrice: number }

const CUSTOM = "__custom__"

let lineKey = 0

export function SaleForm({
  currency,
  timezone,
  defaultPayment,
  products,
  customers = [],
  onDone,
}: {
  currency: string
  timezone: string
  defaultPayment: PaymentMethod
  products: ProductOption[]
  /** Nombres de clientes guardados, para sugerirlos y no crear duplicados. */
  customers?: string[]
  onDone?: () => void
}) {
  const newLine = (): Line => ({
    key: ++lineKey,
    productId: products.length ? "" : CUSTOM,
    description: "",
    quantity: 1,
    unitPrice: 0,
  })
  const [lines, setLines] = React.useState<Line[]>(() => [newLine()])
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(defaultPayment)
  const [date, setDate] = React.useState(() => toDateKey(new Date(), timezone))
  const [customerName, setCustomerName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const byId = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function chooseProduct(key: number, productId: string) {
    const p = byId.get(productId)
    update(key, p ? { productId, description: p.name, unitPrice: p.price } : { productId: CUSTOM, description: "" })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const invalid = lines.find((l) => !l.description.trim() || l.unitPrice <= 0 || l.quantity < 1)
    if (invalid) {
      setError("Completa qué vendiste, la cantidad y el precio en cada línea.")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createSale({
        items: lines.map((l) => ({
          productId: l.productId && l.productId !== CUSTOM ? l.productId : undefined,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        paymentMethod,
        date,
        customerName,
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`Venta de ${formatMoney(total, currency)} guardada`)
      setLines([newLine()])
      setCustomerName("")
      onDone?.()
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-3">
        {lines.map((line, index) => {
          const product = byId.get(line.productId)
          const lowStock = product?.trackStock && product.stock < line.quantity
          return (
            <div key={line.key} className="grid gap-3 rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Producto {index + 1}</span>
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                    aria-label="Quitar producto"
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
              {products.length ? (
                <Select value={line.productId} onValueChange={(v) => chooseProduct(line.key, v)}>
                  <SelectTrigger className="h-10 w-full bg-background" aria-label="Producto o servicio">
                    <SelectValue placeholder="Elige un producto" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-72">
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {formatMoney(p.price, currency)}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM}>Otro producto o servicio…</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              {line.productId === CUSTOM ? (
                <Input
                  value={line.description}
                  onChange={(e) => update(line.key, { description: e.target.value })}
                  placeholder="¿Qué vendiste? Ej: Corte de pelo"
                  className="h-10 bg-background"
                  maxLength={120}
                  aria-label="Descripción"
                />
              ) : null}
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <div className="flex h-10 items-center rounded-lg border bg-background">
                  <button
                    type="button"
                    className="flex h-full w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                    onClick={() => update(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                    aria-label="Restar uno"
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    inputMode="numeric"
                    value={line.quantity}
                    onChange={(e) => update(line.key, { quantity: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })}
                    className="tabular w-10 bg-transparent text-center text-sm outline-none"
                    aria-label="Cantidad"
                  />
                  <button
                    type="button"
                    className="flex h-full w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                    onClick={() => update(line.key, { quantity: line.quantity + 1 })}
                    aria-label="Sumar uno"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <MoneyInput
                  value={line.unitPrice}
                  onValueChange={(v) => update(line.key, { unitPrice: v })}
                  currency={currency}
                  aria-label="Precio unitario"
                  className="[&_input]:bg-background"
                />
              </div>
              {lowStock ? (
                <p className="text-xs text-warning">
                  Solo te quedan {product.stock} unidades registradas de este producto.
                </p>
              ) : null}
            </div>
          )
        })}
        <Button type="button" variant="outline" onClick={() => setLines((ls) => [...ls, newLine()])}>
          <Plus />
          Agregar otro producto
        </Button>
      </div>

      <Field label="¿Cómo te pagaron?">
        <PaymentChips value={paymentMethod} onChange={setPaymentMethod} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" htmlFor="s-date">
          <Input id="s-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
        </Field>
        <Field label="Cliente" htmlFor="s-customer" optional>
          <Input
            id="s-customer"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={80}
            className="h-10"
            placeholder="Nombre"
            list="sale-customers"
            autoComplete="off"
          />
          <datalist id="sale-customers">
            {customers.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="tabular text-xl font-semibold">{formatMoney(total, currency)}</span>
      </div>
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Guardar venta
      </Button>
    </form>
  )
}
