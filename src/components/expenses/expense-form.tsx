"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { formatMoney } from "@/lib/currency"
import { toDateKey } from "@/lib/dates"
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
}

export function ExpenseForm({
  currency,
  timezone,
  categories,
  editing,
  onDone,
}: {
  currency: string
  timezone: string
  categories: ExpenseCategoryOption[]
  /** Si viene, el formulario edita ese gasto en vez de crear uno nuevo. */
  editing?: ExpenseEdit
  onDone?: () => void
}) {
  const [amount, setAmount] = React.useState(editing?.amount ?? 0)
  const [description, setDescription] = React.useState(editing?.description ?? "")
  const [categoryId, setCategoryId] = React.useState<string | undefined>(editing?.categoryId)
  const [date, setDate] = React.useState(() => editing?.date ?? toDateKey(new Date(), timezone))
  const [supplierName, setSupplierName] = React.useState(editing?.supplierName ?? "")
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({})
  const [pending, startTransition] = React.useTransition()

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
      const input = { amount, description, categoryId, date, supplierName }
      const result = editing ? await updateExpense(editing.id, input) : await createExpense(input)
      if (!result.ok) {
        toast.error(result.message)
        if (!result.ok && result.fieldErrors) {
          setErrors(Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [k, v?.[0]])))
        }
        return
      }
      toast.success(editing ? "Gasto actualizado" : `Gasto de ${formatMoney(amount, currency)} guardado`)
      if (editing) return onDone?.()
      setAmount(0)
      setDescription("")
      setCategoryId(undefined)
      setSupplierName("")
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" htmlFor="e-date">
          <Input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
        </Field>
        <Field label="Proveedor" htmlFor="e-supplier" optional>
          <Input
            id="e-supplier"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            maxLength={80}
            className="h-10"
          />
        </Field>
      </div>
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {editing ? "Guardar cambios" : "Guardar gasto"}
      </Button>
    </form>
  )
}
