"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/app/field"
import { useSuppliers } from "@/components/app/quick-actions"
import { GUIDE_EXPENSE_SAVED } from "@/components/app/guided-tour"
import { MoneyInput } from "@/components/app/money-input"
import { formatMoney } from "@/lib/currency"
import { toDateKey } from "@/lib/dates"
import { isHonorarium, withoutVatCredit } from "@/lib/income-statement"
import { honorariumRetentionRate, percentText } from "@/lib/vat"
import { cn } from "@/lib/utils"
import { createExpense, updateExpense } from "@/server/actions/expenses"

export type ExpenseCategoryOption = { id: string; name: string }

export type ExpenseEdit = {
  id: string
  amount: number
  description: string
  categoryId?: string
  date: string
  supplierName: string
  hasInvoice?: boolean
  /** Impuestos específicos de la factura (ILA, combustibles…). */
  specificTax?: number
  /** Se retuvo el impuesto de la boleta de honorarios. */
  withholds?: boolean
}

export function ExpenseForm({
  currency,
  timezone,
  categories,
  chargesVat = false,
  chile = false,
  editing,
  supplierPreset,
  onDone,
}: {
  currency: string
  timezone: string
  categories: ExpenseCategoryOption[]
  /** El negocio cobra IVA: se pregunta si el gasto tiene factura (su IVA se descuenta). */
  chargesVat?: boolean
  /** Negocio en Chile: boletas de honorarios con retención. */
  chile?: boolean
  /** Si viene, el formulario edita ese gasto en vez de crear uno nuevo. */
  editing?: ExpenseEdit
  /** Abrir como compra a este proveedor (categoría de proveedores ya elegida). */
  supplierPreset?: string
  onDone?: () => void
}) {
  const [amount, setAmount] = React.useState(editing?.amount ?? 0)
  const [description, setDescription] = React.useState(editing?.description ?? (supplierPreset ? `Compra a ${supplierPreset}` : ""))
  const [categoryId, setCategoryId] = React.useState<string | undefined>(
    editing?.categoryId ?? (supplierPreset ? categories.find((c) => /proveedor/i.test(c.name))?.id : undefined),
  )
  const [date, setDate] = React.useState(() => editing?.date ?? toDateKey(new Date(), timezone))
  const [supplierName, setSupplierName] = React.useState(editing?.supplierName ?? supplierPreset ?? "")
  const [hasInvoice, setHasInvoice] = React.useState(editing?.hasInvoice ?? false)
  const [specificTax, setSpecificTax] = React.useState(editing?.specificTax ?? 0)
  const [withholds, setWithholds] = React.useState(editing?.withholds ?? true)
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({})
  const [pending, startTransition] = React.useTransition()
  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? ""
  const suppliers = useSuppliers()
  // Compra a proveedores: se elige de la lista de proveedores registrados (o se escribe uno nuevo).
  const toSupplier = /proveedor/i.test(categoryName)
  const query = supplierName.trim().toLowerCase()
  const supplierOptions = (query ? suppliers.filter((s) => s.toLowerCase().includes(query)) : suppliers).slice(0, 12)
  const isNewSupplier = Boolean(query) && !suppliers.some((s) => s.toLowerCase() === query)

  function pickSupplier(name: string) {
    setSupplierName(name)
    // Si no escribió descripción (o quedó la de la categoría), se completa sola.
    if (!description.trim() || description === categoryName || description.startsWith("Compra a ")) setDescription(`Compra a ${name}`)
  }
  // Sueldos, impuestos, honorarios…: nunca traen IVA que se pueda descontar.
  const noVat = withoutVatCredit(categoryName)
  // Boleta de honorarios: el negocio retiene el impuesto (lo paga en el F29) y le paga a la persona el resto.
  const honorarium = chile && isHonorarium(categoryName)
  const retentionRate = honorariumRetentionRate(Number(date.slice(0, 4)) || new Date().getFullYear())
  const retention = honorarium && withholds ? Math.round(amount * retentionRate) : 0

  function pickCategory(cat: ExpenseCategoryOption) {
    setCategoryId(cat.id === categoryId ? undefined : cat.id)
    // Si no escribió descripción, usamos el nombre de la categoría.
    if (!description.trim()) setDescription(cat.name)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (amount <= 0) errs.amount = "Ingresa el monto del gasto"
    if (description.trim().length < 2) errs.description = "Describe el gasto"
    if (chargesVat && hasInvoice && !noVat && specificTax > amount) errs.specificTax = "No puede ser más que el total de la factura"
    setErrors(errs)
    if (Object.keys(errs).length) return
    startTransition(async () => {
      const invoiced = hasInvoice && !noVat
      const input = {
        amount,
        description,
        categoryId,
        date,
        supplierName,
        ...(chargesVat ? { hasInvoice: invoiced, specificTax: invoiced ? specificTax : 0 } : {}),
        withholds: honorarium && withholds,
      }
      const result = editing ? await updateExpense(editing.id, input) : await createExpense(input)
      if (!result.ok) {
        toast.error(result.message)
        if (!result.ok && result.fieldErrors) {
          setErrors(Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [k, v?.[0]])))
        }
        return
      }
      toast.success(
        result.message?.includes("ficha")
          ? result.message
          : editing
            ? "Gasto actualizado"
            : `Gasto de ${formatMoney(amount, currency)} guardado`,
      )
      if (editing) return onDone?.()
      window.dispatchEvent(new Event(GUIDE_EXPENSE_SAVED))
      setAmount(0)
      setDescription("")
      setCategoryId(undefined)
      setSupplierName("")
      setHasInvoice(false)
      setSpecificTax(0)
      setWithholds(true)
      onDone?.()
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Field label={honorarium ? "Monto bruto de la boleta" : "¿Cuánto gastaste?"} error={errors.amount}>
        <MoneyInput value={amount} onValueChange={setAmount} currency={currency} size="lg" autoFocus aria-label="Monto" />
      </Field>
      <Field label="¿En qué?">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => pickCategory(cat)}
              aria-pressed={categoryId === cat.id}
              className={cn(
                "rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/50",
                categoryId === cat.id && "border-primary bg-accent text-accent-foreground ring-1 ring-primary",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </Field>
      {toSupplier ? (
        <Field label="¿A qué proveedor le compraste?" htmlFor="e-supplier">
          <div className="space-y-2">
            {supplierOptions.length ? (
              <div className="flex flex-wrap gap-2">
                {supplierOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickSupplier(s)}
                    aria-pressed={supplierName === s}
                    className={cn(
                      "rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/50",
                      supplierName === s && "border-primary bg-accent text-accent-foreground ring-1 ring-primary",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            <Input
              id="e-supplier"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder={suppliers.length ? "Busca o escribe uno nuevo" : "Nombre del proveedor"}
              maxLength={80}
              className="h-10"
            />
            {isNewSupplier ? (
              <p className="text-xs text-muted-foreground">Es nuevo: al guardar creamos su ficha en Proveedores.</p>
            ) : null}
          </div>
        </Field>
      ) : null}
      <Field label="Descripción" htmlFor="e-desc" error={errors.description}>
        <Input
          id="e-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: Cuenta de luz de octubre"
          maxLength={120}
          className="h-10"
        />
      </Field>
      <div className={cn("grid gap-3", !toSupplier && "grid-cols-2")}>
        <Field label="Fecha" htmlFor="e-date">
          <Input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
        </Field>
        {toSupplier ? null : (
          <Field label="Proveedor" htmlFor="e-supplier" optional>
            {/* Sugiere los proveedores registrados mientras escribe. */}
            <Input
              id="e-supplier"
              list="e-supplier-list"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              maxLength={80}
              className="h-10"
            />
            <datalist id="e-supplier-list">
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
        )}
      </div>
      {honorarium ? (
        <label htmlFor="e-withholds" className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm">
          <Checkbox id="e-withholds" checked={withholds} onCheckedChange={(v) => setWithholds(v === true)} className="mt-0.5" />
          <span className="space-y-0.5">
            <span className="block font-medium">Yo retengo el impuesto ({percentText(retentionRate)})</span>
            <span className="block text-xs text-muted-foreground">
              {withholds && amount > 0
                ? `Le pagas ${formatMoney(amount - retention, currency)} a la persona y ${formatMoney(retention, currency)} van al SII en tu F29.`
                : "Si tu negocio es empresa o tiene contabilidad, normalmente retienes tú. Si no, la persona paga su impuesto."}
            </span>
          </span>
        </label>
      ) : null}
      {chargesVat && !noVat ? (
        <label htmlFor="e-invoice" className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm">
          <Checkbox id="e-invoice" checked={hasInvoice} onCheckedChange={(v) => setHasInvoice(v === true)} className="mt-0.5" />
          <span className="space-y-0.5">
            <span className="block font-medium">Tiene factura con IVA a nombre del negocio</span>
            <span className="block text-xs text-muted-foreground">
              {/arriendo/i.test(categoryName)
                ? "El arriendo de un local sin muebles ni instalaciones normalmente no lleva IVA: márcalo solo si la factura trae IVA."
                : "Su IVA se descuenta del IVA que tienes que pagar. Con boleta no se descuenta."}
            </span>
          </span>
        </label>
      ) : null}
      {chargesVat && !noVat && hasInvoice ? (
        <Field label="Impuestos específicos de la factura" error={errors.specificTax} optional>
          <MoneyInput value={specificTax} onValueChange={setSpecificTax} currency={currency} aria-label="Impuestos específicos de la factura" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            El ILA de bebidas alcohólicas o azucaradas, o el impuesto a los combustibles, viene aparte del IVA en la factura. Anótalo aquí para
            calcular bien tu IVA: no se descuenta y queda como parte del costo.
          </p>
        </Field>
      ) : null}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {editing ? "Guardar cambios" : "Guardar gasto"}
      </Button>
    </form>
  )
}
