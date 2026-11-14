"use client"

import { allowsDecimals, formatQuantity, lineTotal, SALE_UNIT_INFO, saleUnitOf, validQuantity } from "@/lib/units"
import { QuantityInput } from "@/components/app/quantity-input"
import * as React from "react"
import { Loader2, Minus, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { GUIDE_SALE_SAVED } from "@/components/app/guided-tour"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScanButton, type ScanFeedback } from "@/components/app/barcode-scanner"
import { findByCode } from "@/lib/barcodes"
import { noteFeatureUse } from "@/server/actions/usage"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { PaymentChips } from "@/components/app/payment-chips"
import { formatMoney } from "@/lib/currency"
import { toDateKey } from "@/lib/dates"
import { createSale, updateSale } from "@/server/actions/sales"
import { afterSaleSaved } from "@/components/sales/sale-receipt"
import { useOfflineSales } from "@/components/app/offline-sales"
import { useCanApproveDiscounts, usePromotions } from "@/components/app/quick-actions"
import { applyPromotions } from "@/lib/promotions"
import { DiscountField, type DiscountValue } from "@/components/sales/discount-field"
import { CashChange } from "@/components/sales/cash-change"
import { CardFeeNote } from "@/components/sales/card-fee-note"
import { earnedPart } from "@/lib/loyalty"

export type ProductOption = { id: string; name: string; price: number; stock: number; trackStock: boolean; codes?: string[]; categoryId?: string | null; /** "u", "kg" o "m". */ saleUnit?: string }

type Line = { key: number; productId: string; description: string; quantity: number; unitPrice: number }

export type SaleEdit = {
  id: string
  lines: { productId: string | null; description: string; quantity: number; unitPrice: number }[]
  paymentMethod: PaymentMethod
  date: string
  customerName: string
  note: string
}

const CUSTOM = "__custom__"

let lineKey = 0

export function SaleForm({
  currency,
  timezone,
  defaultPayment,
  products,
  customers = [],
  editing,
  onDone,
  continuousScan = true,
  productsOnly = false,
}: {
  /** Solo productos guardados (empleados, según la configuración del negocio): sin "Otro producto". */
  productsOnly?: boolean
  /** Escaneo continuo (Pro): la cámara queda abierta. Si no, se escanea de a un producto. */
  continuousScan?: boolean
  currency: string
  timezone: string
  defaultPayment: PaymentMethod
  products: ProductOption[]
  /** Nombres de clientes guardados, para sugerirlos y no crear duplicados. */
  customers?: string[]
  /** Si viene, el formulario edita esa venta en vez de crear una nueva. */
  editing?: SaleEdit
  onDone?: () => void
}) {
  const newLine = (): Line => ({
    key: ++lineKey,
    productId: products.length || productsOnly ? "" : CUSTOM,
    description: "",
    quantity: 1,
    unitPrice: 0,
  })
  const [lines, setLines] = React.useState<Line[]>(() =>
    editing?.lines.length
      ? editing.lines.map((l) => ({
          key: ++lineKey,
          productId: l.productId ?? CUSTOM,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        }))
      : [newLine()],
  )
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(editing?.paymentMethod ?? defaultPayment)
  const [date, setDate] = React.useState(() => editing?.date ?? toDateKey(new Date(), timezone))
  const [customerName, setCustomerName] = React.useState(editing?.customerName ?? "")
  const fiado = paymentMethod === "FIADO"
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const offline = useOfflineSales()
  const byId = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const gross = lines.reduce((sum, l) => sum + lineTotal(l.quantity, l.unitPrice), 0)
  // Promociones vigentes (2×1, %, happy hour): se ven al tiro; al guardar, el servidor las vuelve a calcular.
  const rules = usePromotions()
  const promo = React.useMemo(
    () =>
      applyPromotions(
        lines.map((l) => ({ key: l.key, productId: l.productId && l.productId !== CUSTOM ? l.productId : null, categoryId: byId.get(l.productId)?.categoryId ?? null, quantity: l.quantity, unitPrice: l.unitPrice })),
        rules,
        { now: new Date(), timezone, channel: "store" },
      ),
    [lines, rules, byId, timezone],
  )
  const subtotal = gross - promo.discount
  // Descuento (solo al registrar una venta nueva): directo si eres encargado, con aprobación si eres empleado.
  const canApprove = useCanApproveDiscounts()
  const [disc, setDisc] = React.useState<{ value: DiscountValue | null; blocked: string | null }>({ value: null, blocked: null })
  const [discKey, setDiscKey] = React.useState(0)
  const total = subtotal - (disc.value?.discount ?? 0)

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function chooseProduct(key: number, productId: string) {
    const p = byId.get(productId)
    update(key, p ? { productId, description: p.name, unitPrice: p.price } : { productId: CUSTOM, description: "" })
  }

  /** Producto escaneado: si ya está en la venta suma una unidad; si no, ocupa una línea vacía o agrega una. */
  const scanNoted = React.useRef(false)
  function addScanned(code: string): ScanFeedback {
    if (!scanNoted.current) {
      scanNoted.current = true
      void noteFeatureUse("escaneo").catch(() => {})
    }
    const p = findByCode(products, code)
    if (!p) return { ok: false, message: `No hay un producto con el código ${code}. Agrégalo en Productos con ese código.` }
    const inSale = (lines.find((l) => l.productId === p.id)?.quantity ?? 0) + 1
    setLines((ls) => {
      const same = ls.find((l) => l.productId === p.id)
      if (same) return ls.map((l) => (l.key === same.key ? { ...l, quantity: l.quantity + 1 } : l))
      const empty = ls.find((l) => !l.productId)
      const filled = { productId: p.id, description: p.name, unitPrice: p.price, quantity: 1 }
      if (empty) return ls.map((l) => (l.key === empty.key ? { ...l, ...filled } : l))
      return [...ls, { ...newLine(), ...filled }]
    })
    const stock = p.trackStock ? ` · quedan ${formatQuantity(p.stock - inSale, p.saleUnit)}` : ""
    return { ok: true, message: `${p.name} ×${formatQuantity(inSale, p.saleUnit)} · ${formatMoney(p.price, currency)}${stock}` }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const invalid = lines.find((l) => !l.description.trim() || l.unitPrice <= 0 || !validQuantity(l.quantity, byId.get(l.productId)?.saleUnit))
    if (invalid) {
      setError("Completa qué vendiste, la cantidad y el precio en cada línea.")
      return
    }
    if (fiado && !customerName.trim()) {
      setError("Para fiar, escribe el nombre del cliente.")
      return
    }
    if (!editing && disc.blocked) {
      setError(disc.blocked)
      return
    }
    setError(null)
    startTransition(async () => {
      const input = {
        items: lines.map((l) => ({
          productId: l.productId && l.productId !== CUSTOM ? l.productId : undefined,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        paymentMethod,
        date,
        customerName,
        note: editing?.note,
        ...(!editing && disc.value ? disc.value : {}),
      }
      const result = editing
        ? await updateSale(editing.id, input)
        : offline
          ? await offline.save({ kind: "detail", input, total })
          : await createSale(input)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      if ("offline" in result && result.offline) {
        toast.success(`Sin internet: la venta de ${formatMoney(total, currency)} quedó guardada en este equipo y se subirá sola.`)
      } else {
        toast.success(editing ? "Venta actualizada" : `Venta de ${formatMoney(total, currency)} guardada${earnedPart(result.message)}`)
      }
      if (!editing) {
        window.dispatchEvent(new Event(GUIDE_SALE_SAVED))
        setLines([newLine()])
        setCustomerName("")
        setDiscKey((k) => k + 1)
        setDisc({ value: null, blocked: null })
      }
      onDone?.()
      if (!editing && "data" in result && result.data && "saleId" in result.data) void afterSaleSaved(result.data.saleId)
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      {productsOnly ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {products.length
            ? "Vendes con los productos guardados. Si falta alguno, pídele al encargado que lo agregue en Productos."
            : "Todavía no hay productos guardados. Pídele al encargado que los agregue en Productos para poder vender."}
        </p>
      ) : null}
      <div className="grid gap-3">
        {products.length ? (
          <div className="flex *:h-11 *:w-full *:text-base">
            <ScanButton
              continuous={continuousScan}
              label={continuousScan ? "Escanear productos" : "Escanear producto"}
              onResult={addScanned}
            />
          </div>
        ) : null}
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
                    {productsOnly ? null : <SelectItem value={CUSTOM}>Otro producto o servicio…</SelectItem>}
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
                {/* Por kilo o por metro: se escribe la cantidad con decimales ("1,5 m"). Por unidad: más y menos. */}
                {allowsDecimals(product?.saleUnit) ? (
                  <QuantityInput
                    unit={product?.saleUnit}
                    value={line.quantity}
                    onValueChange={(q) => update(line.key, { quantity: q })}
                    aria-label={`Cantidad en ${SALE_UNIT_INFO[saleUnitOf(product?.saleUnit)].per}s`}
                    className="w-32 [&_input]:bg-background"
                  />
                ) : (
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
                )}
                <MoneyInput
                  value={line.unitPrice}
                  onValueChange={(v) => update(line.key, { unitPrice: v })}
                  currency={currency}
                  aria-label={allowsDecimals(product?.saleUnit) ? `Precio por ${SALE_UNIT_INFO[saleUnitOf(product?.saleUnit)].per}` : "Precio unitario"}
                  // Los empleados no cambian el precio de un producto guardado: para cobrar menos, piden un descuento.
                  readOnly={!canApprove && Boolean(product)}
                  title={!canApprove && product ? "Para cobrar menos, agrega un descuento abajo" : undefined}
                  className="[&_input]:bg-background [&_input:read-only]:text-muted-foreground"
                />
              </div>
              {lowStock ? (
                <p className="text-xs text-warning">Solo te quedan {product.saleUnit && product.saleUnit !== "u" ? formatQuantity(product.stock, product.saleUnit) : `${product.stock} unidades`} registradas de este producto.</p>
              ) : product?.trackStock && !editing ? (
                <p className="text-xs text-muted-foreground">
                  En stock: {formatQuantity(product.stock, product.saleUnit)} · después de esta venta quedan {formatQuantity(product.stock - line.quantity, product.saleUnit)}
                  {allowsDecimals(product.saleUnit) && line.quantity > 0 ? ` · ${formatMoney(lineTotal(line.quantity, line.unitPrice), currency)}` : ""}
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
        <Field label={fiado ? "¿A quién le fiaste?" : "Cliente"} htmlFor="s-customer" optional={!fiado}>
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

      {!editing && subtotal > 0 ? (
        <DiscountField
          key={discKey}
          subtotal={subtotal}
          context="Venta"
          canApprove={canApprove}
          currency={currency}
          onChange={(state) => {
            setDisc(state)
            // Si ya se puede guardar (aprobado o sin descuento), se quita el aviso.
            if (!state.blocked) setError(null)
          }}
        />
      ) : null}

      <div className="rounded-xl bg-muted px-4 py-3">
        {promo.discount ? (
          <>
            <div className="mb-1 flex items-center justify-between text-sm text-muted-foreground">
              <span>Productos</span>
              <span className="tabular">{formatMoney(gross, currency)}</span>
            </div>
            {promo.applied.map((a) => (
              <div key={a.promotionId} className="mb-1 flex items-center justify-between text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <span>🏷️ {a.name}</span>
                <span className="tabular">−{formatMoney(a.amount, currency)}</span>
              </div>
            ))}
          </>
        ) : null}
        {disc.value ? (
          <div className="mb-1 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Subtotal {formatMoney(subtotal, currency)} · descuento
            </span>
            <span className="tabular">−{formatMoney(disc.value.discount, currency)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="tabular text-xl font-semibold">{formatMoney(total, currency)}</span>
        </div>
      </div>
      {!editing && paymentMethod === "CASH" ? <CashChange key={`vuelto-${discKey}`} total={total} currency={currency} /> : null}
      <CardFeeNote total={total} method={paymentMethod} currency={currency} />
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {editing ? "Guardar cambios" : fiado ? "Anotar fiado" : "Guardar venta"}
      </Button>
    </form>
  )
}
