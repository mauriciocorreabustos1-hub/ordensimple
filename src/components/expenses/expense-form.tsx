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
import { withoutVatCredit } from "@/lib/income-statement"
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
}

export function ExpenseForm({
  currency,
  timezone,
  categories,
  chargesVat = false,
  editing,
  supplierPreset,
  onDone,
}: {
  currency: string
  timezone: string
  categories: ExpenseCategoryOption[]
  /** El negocio cobra IVA: se pregunta si el gasto tiene factura (su IVA se descuenta). */
  chargesVat?: boolean
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
    setErrors(errs)
    if (Object.keys(errs).length) return
    startTransition(async () => {
      const input = { amount, description, categoryId, date, supplierName, ...(chargesVat ? { hasInvoice: hasInvoice && !noVat } : {}) }
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
      onDone?.()
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Field label="¿Cuánto gastaste?" error={errors.amount}>
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
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {editing ? "Guardar cambios" : "Guardar gasto"}
      </Button>
    </form>
  )
}
