"use client"

import * as React from "react"
import { Loader2, Minus, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { useCanApproveDiscounts } from "@/components/app/quick-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatMoney } from "@/lib/currency"
import type { QuoteItem } from "@/lib/quotes"
import { createQuote, updateQuote } from "@/server/actions/quotes"

export type QuoteProduct = { id: string; name: string; price: number }
export type QuoteCustomer = { id: string; name: string; phone: string | null; email: string | null }

/** Lo que se edita de una cotización existente. */
export type QuoteDraft = {
  id: string
  customerId: string | null
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  items: QuoteItem[]
  discount: number
  note: string | null
  validDays: number
}

type Line = { key: number; productId: string; description: string; quantity: number; unitPrice: number }

const CUSTOM = "__custom__"
const NEW_CUSTOMER = "__nuevo__"
let lineKey = 0

export function QuoteForm({
  currency,
  products,
  customers,
  validDays,
  productsOnly,
  editing,
  onDone,
}: {
  currency: string
  products: QuoteProduct[]
  customers: QuoteCustomer[]
  /** Días de validez por defecto (de los datos del negocio). */
  validDays: number
  /** Empleados restringidos: solo productos guardados. */
  productsOnly: boolean
  editing?: QuoteDraft
  onDone: (created?: { id: string; token: string; number: number }) => void
}) {
  const money = (n: number) => formatMoney(n, currency)
  const byId = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const canApprove = useCanApproveDiscounts()
  const newLine = (): Line => ({ key: ++lineKey, productId: products.length || productsOnly ? "" : CUSTOM, description: "", quantity: 1, unitPrice: 0 })
  const [lines, setLines] = React.useState<Line[]>(() =>
    editing?.items.length
      ? editing.items.map((i) => ({ key: ++lineKey, productId: i.productId && byId.has(i.productId) ? i.productId : CUSTOM, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice }))
      : [newLine()],
  )
  const [customerId, setCustomerId] = React.useState(editing?.customerId ?? NEW_CUSTOMER)
  const [name, setName] = React.useState(editing?.customerName ?? "")
  const [phone, setPhone] = React.useState(editing?.customerPhone ?? "")
  const [email, setEmail] = React.useState(editing?.customerEmail ?? "")
  const [discount, setDiscount] = React.useState(editing?.discount ?? 0)
  const [days, setDays] = React.useState(String(editing?.validDays ?? validDays))
  const [note, setNote] = React.useState(editing?.note ?? "")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const total = subtotal - discount

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function chooseProduct(key: number, productId: string) {
    const p = byId.get(productId)
    update(key, p ? { productId, description: p.name, unitPrice: p.price } : { productId: CUSTOM, description: "" })
  }

  function chooseCustomer(id: string) {
    setCustomerId(id)
    const c = customers.find((x) => x.id === id)
    setName(c?.name ?? "")
    setPhone(c?.phone ?? "")
    setEmail(c?.email ?? "")
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) return setError("Escribe el nombre del cliente.")
    if (lines.some((l) => !l.description.trim() || l.unitPrice <= 0 || l.quantity < 1)) return setError("Completa el producto, la cantidad y el precio en cada línea.")
    if (discount && discount >= subtotal) return setError("El descuento no puede ser igual o mayor que el total.")
    const validDaysN = Number(days)
    if (!Number.isInteger(validDaysN) || validDaysN < 1 || validDaysN > 365) return setError("La validez debe ser entre 1 y 365 días.")
    setError(null)
    startTransition(async () => {
      const input = {
        customerId: customerId !== NEW_CUSTOMER ? customerId : undefined,
        customerName: name,
        customerPhone: phone || undefined,
        customerEmail: email || undefined,
        items: lines.map((l) => ({
          productId: l.productId && l.productId !== CUSTOM ? l.productId : undefined,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        discount: discount || undefined,
        note: note || undefined,
        validDays: validDaysN,
      }
      const r = editing ? await updateQuote(editing.id, input) : await createQuote(input)
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message)
      onDone("data" in r && r.data ? r.data : undefined)
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-3 rounded-xl border p-3">
        <p className="text-sm font-medium">Cliente</p>
        {customers.length ? (
          <Select value={customerId} onValueChange={chooseCustomer}>
            <SelectTrigger className="h-10 w-full" aria-label="Cliente guardado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              <SelectItem value={NEW_CUSTOMER}>Cliente nuevo (escribir sus datos)</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Field label="Nombre o empresa" htmlFor="q-name">
          <Input id="q-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-10" placeholder="Ej: Constructora Los Andes" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="WhatsApp" htmlFor="q-phone" optional>
            <Input id="q-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} inputMode="tel" className="h-10" placeholder="+56 9 1234 5678" />
          </Field>
          <Field label="Correo" htmlFor="q-email" optional>
            <Input id="q-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} className="h-10" />
          </Field>
        </div>
      </div>

      <div className="grid gap-3">
        {lines.map((line, index) => {
          const product = byId.get(line.productId)
          return (
            <div key={line.key} className="grid gap-3 rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Línea {index + 1}</span>
                {lines.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))} aria-label="Quitar línea">
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
                        {p.name} · {money(p.price)}
                      </SelectItem>
                    ))}
                    {productsOnly ? null : <SelectItem value={CUSTOM}>Otro producto o servicio…</SelectItem>}
                  </SelectContent>
                </Select>
              ) : null}
              {line.productId === CUSTOM ? (
                <Input
                  value={line.description}
                  onChange={(e) => update(line.key, { description: e.target.value })}
                  placeholder="Ej: Instalación eléctrica"
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
                    onChange={(e) => update(line.key, { quantity: Math.min(100_000, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)) })}
                    className="tabular w-12 bg-transparent text-center text-sm outline-none"
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
                  // Los empleados no bajan el precio de un producto guardado.
                  readOnly={!canApprove && Boolean(product)}
                  className="[&_input]:bg-background [&_input:read-only]:text-muted-foreground"
                />
              </div>
              {line.quantity > 1 && line.unitPrice ? (
                <p className="text-right text-xs text-muted-foreground">
                  {line.quantity} × {money(line.unitPrice)} = <span className="tabular font-medium text-foreground">{money(line.quantity * line.unitPrice)}</span>
                </p>
              ) : null}
            </div>
          )
        })}
        <Button type="button" variant="outline" onClick={() => setLines((ls) => [...ls, newLine()])}>
          <Plus />
          Agregar otra línea
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {canApprove ? (
          <Field label="Descuento" htmlFor="q-discount" optional>
            <MoneyInput id="q-discount" value={discount} onValueChange={setDiscount} currency={currency} />
          </Field>
        ) : null}
        <Field label="Válida por (días)" htmlFor="q-days">
          <Input id="q-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 3))} className="h-10" />
        </Field>
      </div>
      <Field label="Nota para el cliente" htmlFor="q-note" optional hint="Plazo de entrega, forma de pago o lo que necesite saber. Las condiciones generales se agregan solas.">
        <Textarea id="q-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} rows={3} />
      </Field>

      <div className="rounded-xl bg-muted px-4 py-3">
        {discount ? (
          <div className="mb-1 flex items-center justify-between text-sm text-muted-foreground">
            <span>Subtotal {money(subtotal)} · descuento</span>
            <span className="tabular">−{money(discount)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="tabular text-xl font-semibold">{money(Math.max(0, total))}</span>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {editing ? "Guardar cambios" : "Crear cotización"}
      </Button>
    </form>
  )
}
