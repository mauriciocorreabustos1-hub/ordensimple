"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field } from "@/components/app/field"
import { ScanButton } from "@/components/app/barcode-scanner"
import { MoneyInput } from "@/components/app/money-input"
import { Explainer } from "@/components/app/explainer"
import { marginRatio } from "@/lib/calculations"
import { formatMoney, formatPercent, referenceAmount } from "@/lib/currency"
import type { ProductInput } from "@/lib/validations"
import { createProduct, updateProduct } from "@/server/actions/products"

export type ProductFormValues = {
  name: string
  sku: string
  categoryName: string
  cost: number
  price: number
  stock: number
  minStock: number
  trackStock: boolean
  active: boolean
  /** Próximo vencimiento "AAAA-MM-DD" o "". */
  expiresAt: string
}

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "",
  sku: "",
  categoryName: "",
  cost: 0,
  price: 0,
  stock: 0,
  minStock: 0,
  trackStock: true,
  active: true,
  expiresAt: "",
}

function intValue(v: string) {
  return Math.max(0, Number(v.replace(/\D/g, "")) || 0)
}

export function ProductForm({
  productId,
  initial,
  currency,
  categories,
  onDone,
}: {
  productId?: string
  initial: ProductFormValues
  currency: string
  categories: string[]
  onDone?: () => void
}) {
  const [v, setV] = React.useState(initial)
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({})
  const [pending, startTransition] = React.useTransition()
  const set = <K extends keyof ProductFormValues>(k: K, value: ProductFormValues[K]) => setV((s) => ({ ...s, [k]: value }))
  const money = (n: number) => formatMoney(n, currency)

  const profit = v.price - v.cost
  const margin = marginRatio(v.price, v.cost)
  const ref = referenceAmount(currency)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (v.name.trim().length < 2) errs.name = "Escribe el nombre"
    if (v.price <= 0) errs.price = "Ingresa el precio de venta"
    setErrors(errs)
    if (Object.keys(errs).length) return
    const input: ProductInput = { ...v }
    startTransition(async () => {
      const result = productId ? await updateProduct(productId, input) : await createProduct(input)
      if (!result.ok) {
        toast.error(result.message)
        if (result.fieldErrors) {
          setErrors(Object.fromEntries(Object.entries(result.fieldErrors).map(([k, m]) => [k, m?.[0]])))
        }
        return
      }
      toast.success(result.message ?? "Guardado")
      onDone?.()
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label="Nombre" htmlFor="p-name" error={errors.name}>
        <Input id="p-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej: Coca-Cola 1.5L" className="h-10" maxLength={100} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría" htmlFor="p-cat" optional>
          <Input id="p-cat" list="product-categories" value={v.categoryName} onChange={(e) => set("categoryName", e.target.value)} placeholder="Ej: Bebidas" className="h-10" maxLength={40} />
          <datalist id="product-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Código de barras" htmlFor="p-sku" optional>
          <div className="flex gap-2">
            <Input id="p-sku" value={v.sku} onChange={(e) => set("sku", e.target.value)} className="h-10" maxLength={40} />
            <ScanButton size="icon" label="Escanear código de barras" onResult={(code) => set("sku", code)} />
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="¿Cuánto te cuesta?" hint="Lo que pagas al proveedor por unidad." error={errors.cost}>
          <MoneyInput value={v.cost} onValueChange={(n) => set("cost", n)} currency={currency} aria-label="Costo" />
        </Field>
        <Field label="¿A cuánto lo vendes?" error={errors.price}>
          <MoneyInput value={v.price} onValueChange={(n) => set("price", n)} currency={currency} aria-label="Precio de venta" />
        </Field>
      </div>

      {v.price > 0 ? (
        profit > 0 ? (
          <Explainer title={`Ganas ${money(profit)} por unidad · margen ${formatPercent(margin, 0)}`}>
            Por cada unidad vendida ganas aproximadamente {money(profit)}. El margen de {formatPercent(margin, 0)}{" "}
            significa que por cada {money(ref)} vendidos de este producto, unos {money(Math.round(ref * margin))} quedan
            antes de otros gastos.
          </Explainer>
        ) : (
          <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm">
            Con este precio no ganas nada: el producto te cuesta {profit === 0 ? "lo mismo que" : "más de lo que"} lo vendes.
          </p>
        )
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
        <div>
          <p className="text-sm font-medium">Controlar stock</p>
          <p className="text-xs text-muted-foreground">Descontamos unidades cada vez que lo vendes.</p>
        </div>
        <Switch checked={v.trackStock} onCheckedChange={(c) => set("trackStock", c)} aria-label="Controlar stock" />
      </div>
      {v.trackStock ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock actual" htmlFor="p-stock">
            <Input id="p-stock" inputMode="numeric" value={v.stock} onChange={(e) => set("stock", intValue(e.target.value))} className="tabular h-10" />
          </Field>
          <Field label="Avisarme si quedan menos de" htmlFor="p-min">
            <Input id="p-min" inputMode="numeric" value={v.minStock} onChange={(e) => set("minStock", intValue(e.target.value))} className="tabular h-10" />
          </Field>
          <Field label="Próximo vencimiento" htmlFor="p-exp" optional hint="Te avisamos en Inventario cuando falten 7 días.">
            <Input id="p-exp" type="date" value={v.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} className="h-10" />
          </Field>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
        <div>
          <p className="text-sm font-medium">Producto activo</p>
          <p className="text-xs text-muted-foreground">Los inactivos no aparecen al registrar ventas.</p>
        </div>
        <Switch checked={v.active} onCheckedChange={(c) => set("active", c)} aria-label="Producto activo" />
      </div>
      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {productId ? "Guardar cambios" : "Crear producto"}
      </Button>
    </form>
  )
}
