"use client"

import { SALE_UNIT_INFO, SALE_UNITS, type SaleUnit } from "@/lib/units"
import { QuantityInput } from "@/components/app/quantity-input"
import { cn } from "@/lib/utils"
import * as React from "react"
import { Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field } from "@/components/app/field"
import { ScanButton } from "@/components/app/barcode-scanner"
import { MoneyInput } from "@/components/app/money-input"
import { Explainer } from "@/components/app/explainer"
import { useSalesVat } from "@/components/app/quick-actions"
import { marginRatio } from "@/lib/calculations"
import { formatMoney, formatPercent, referenceAmount } from "@/lib/currency"
import type { ProductInput } from "@/lib/validations"
import { createProduct, updateProduct } from "@/server/actions/products"

export type ProductFormValues = {
  name: string
  /** Todos sus códigos de barras: el primero es el principal. */
  codes: string[]
  categoryName: string
  cost: number
  price: number
  /** Por unidad ("u"), por kilo ("kg") o por metro ("m"). */
  saleUnit: SaleUnit
  stock: number
  minStock: number
  trackStock: boolean
  active: boolean
  /** Próximo vencimiento "AAAA-MM-DD" o "". */
  expiresAt: string
}

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "",
  codes: [],
  categoryName: "",
  cost: 0,
  price: 0,
  saleUnit: "u",
  stock: 0,
  minStock: 0,
  trackStock: true,
  active: true,
  expiresAt: "",
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
  const per = SALE_UNIT_INFO[v.saleUnit].per
  // Al pasar a "por unidad", el stock vuelve a enteros.
  const setUnit = (u: SaleUnit) =>
    setV((s) => ({ ...s, saleUnit: u, ...(u === "u" ? { stock: Math.round(s.stock), minStock: Math.round(s.minStock) } : {}) }))
  const [newCode, setNewCode] = React.useState("")

  /** Agrega un código a la lista (escaneado, escrito o desde un lector USB que termina con Enter). */
  function addCode(raw: string) {
    const code = raw.trim()
    if (!code) return
    if (v.codes.some((c) => c.toLowerCase() === code.toLowerCase())) {
      toast.info("Ese código ya está agregado")
    } else {
      set("codes", [...v.codes, code])
    }
    setNewCode("")
  }
  const money = (n: number) => formatMoney(n, currency)

  // Si el negocio cobra IVA, los precios y costos van con IVA incluido (así se calcula el F29).
  // Lo que de verdad ganas es sin IVA: el IVA de la venta se paga al SII (descontando el de la compra).
  const vat = useSalesVat()
  const rate = vat?.rate ? vat.rate : 0
  const profit = Math.round((v.price - v.cost) / (1 + rate))
  const margin = marginRatio(v.price, v.cost)
  const net = Math.round(v.price / (1 + rate))
  const [vatAdded, setVatAdded] = React.useState(false)
  const ref = referenceAmount(currency)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (v.name.trim().length < 2) errs.name = "Escribe el nombre"
    if (v.price <= 0) errs.price = "Ingresa el precio de venta"
    setErrors(errs)
    if (Object.keys(errs).length) return
    // Lo que quedó escrito sin tocar "Agregar" también se guarda.
    const codes = newCode.trim() && !v.codes.includes(newCode.trim()) ? [...v.codes, newCode.trim()] : v.codes
    const input: ProductInput = { ...v, codes, sku: codes[0] }
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
      <div className="grid gap-3">
        <Field label="Categoría" htmlFor="p-cat" optional>
          <Input id="p-cat" list="product-categories" value={v.categoryName} onChange={(e) => set("categoryName", e.target.value)} placeholder="Ej: Bebidas" className="h-10" maxLength={40} />
          <datalist id="product-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field
        label="Códigos de barras"
        htmlFor="p-code"
        optional
        hint="Un producto puede tener varios códigos (otra presentación, otra planta o proveedor). Todos se venden al mismo precio."
      >
        <div className="space-y-2">
          {v.codes.length ? (
            <div className="flex flex-wrap gap-2">
              {v.codes.map((c, i) => (
                <span key={c} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 py-1 pr-1 pl-3 font-mono text-xs">
                  {c}
                  {i === 0 && v.codes.length > 1 ? <span className="font-sans text-[10px] text-muted-foreground">principal</span> : null}
                  <button
                    type="button"
                    onClick={() => set("codes", v.codes.filter((x) => x !== c))}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Quitar el código ${c}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Input
              id="p-code"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addCode(newCode)
                }
              }}
              placeholder="Escribe o escanea un código"
              className="h-10 font-mono"
              maxLength={40}
            />
            <Button type="button" variant="outline" className="h-10" onClick={() => addCode(newCode)} aria-label="Agregar código">
              <Plus />
              <span className="max-sm:hidden">Agregar</span>
            </Button>
            <ScanButton size="icon" label="Escanear código de barras" onResult={addCode} />
          </div>
        </div>
      </Field>
      <Field label="¿Cómo lo vendes?" hint={v.saleUnit === "u" ? undefined : `El precio es por ${per} y al vender escribes cuánto: ${SALE_UNIT_INFO[v.saleUnit].example} ${SALE_UNIT_INFO[v.saleUnit].short}.`}>
        <div role="radiogroup" aria-label="Cómo se vende" className="grid grid-cols-3 gap-2">
          {SALE_UNITS.map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={v.saleUnit === u}
              onClick={() => setUnit(u)}
              className={cn(
                "h-10 rounded-lg border px-2 text-sm font-medium transition-colors hover:border-primary/50",
                v.saleUnit === u && "border-primary bg-accent text-accent-foreground ring-1 ring-primary",
              )}
            >
              {SALE_UNIT_INFO[u].label}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="¿Cuánto te cuesta?" hint={rate ? `Lo que pagas al proveedor por ${per}, con ${vat!.label}.` : `Lo que pagas al proveedor por ${per}.`} error={errors.cost}>
          <MoneyInput value={v.cost} onValueChange={(n) => set("cost", n)} currency={currency} aria-label="Costo" />
        </Field>
        <Field label="¿A cuánto lo vendes?" hint={rate ? `Precio final al cliente por ${per}, con ${vat!.label} incluido.` : v.saleUnit === "u" ? undefined : `Precio por ${per}.`} error={errors.price}>
          <MoneyInput
            value={v.price}
            onValueChange={(n) => {
              set("price", n)
              setVatAdded(false)
            }}
            currency={currency}
            aria-label="Precio de venta"
          />
        </Field>
      </div>
      {rate && v.price > 0 ? (
        <div className="space-y-1 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <p>
            Precio con {vat!.label}: <span className="tabular font-medium text-foreground">{money(v.price)}</span> · neto{" "}
            <span className="tabular">{money(net)}</span> + {vat!.label} <span className="tabular">{money(v.price - net)}</span>
          </p>
          {vatAdded ? (
            <p className="text-emerald-700 dark:text-emerald-400">Listo: le sumamos el {vat!.label} al precio.</p>
          ) : (
            <p>
              ¿Escribiste el precio sin {vat!.label}?{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  set("price", Math.round(v.price * (1 + rate)))
                  setVatAdded(true)
                }}
              >
                Súmale el {vat!.label} ({Math.round(rate * 100)} %)
              </button>
            </p>
          )}
        </div>
      ) : null}

      {v.price > 0 ? (
        profit > 0 ? (
          <Explainer title={`Ganas ${money(profit)} por ${per} · margen ${formatPercent(margin, 0)}`}>
            Por cada {per} vendid{v.saleUnit === "u" ? "a" : "o"} ganas aproximadamente {money(profit)}
            {rate ? `, ya sin el ${vat!.label}, que se declara y paga cada mes` : ""}. El margen de {formatPercent(margin, 0)}{" "}
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
          <p className="text-xs text-muted-foreground">{v.saleUnit === "u" ? "Descontamos unidades cada vez que lo vendes." : `Descontamos los ${per}s que vendes.`}</p>
        </div>
        <Switch checked={v.trackStock} onCheckedChange={(c) => set("trackStock", c)} aria-label="Controlar stock" />
      </div>
      {v.trackStock ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock actual" htmlFor="p-stock" error={errors.stock}>
            <QuantityInput key={`s-${v.saleUnit}`} id="p-stock" unit={v.saleUnit} value={v.stock} onValueChange={(n) => set("stock", n)} />
          </Field>
          <Field label="Avisarme si quedan menos de" htmlFor="p-min">
            <QuantityInput key={`m-${v.saleUnit}`} id="p-min" unit={v.saleUnit} value={v.minStock} onValueChange={(n) => set("minStock", n)} />
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
