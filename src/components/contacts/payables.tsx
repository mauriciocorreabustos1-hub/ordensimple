"use client"

import * as React from "react"
import { Check, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { toDateKey } from "@/lib/dates"
import { createPayable, deletePayable, markPayablePaid } from "@/server/actions/payables"

/** "Agregar pago pendiente": una factura o deuda con un proveedor y su fecha de vencimiento. */
export function PayableDialog({ currency, timezone, suppliers }: { currency: string; timezone: string; suppliers: string[] }) {
  const [open, setOpen] = React.useState(false)
  const [description, setDescription] = React.useState("")
  const [supplierName, setSupplierName] = React.useState("")
  const [amount, setAmount] = React.useState(0)
  const [dueDate, setDueDate] = React.useState(() => toDateKey(new Date(), timezone))
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({})
  const [pending, startTransition] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await createPayable({ description, supplierName, amount, dueDate })
      if (!r.ok) {
        setErrors(Object.fromEntries(Object.entries(r.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0]])))
        return void toast.error(r.message)
      }
      toast.success(r.message ?? "Guardado")
      setOpen(false)
      setDescription("")
      setSupplierName("")
      setAmount(0)
      setErrors({})
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus />
        Agregar pago pendiente
      </Button>
      <AppModal open={open} onOpenChange={setOpen} title="Pago pendiente a proveedor" description="Te avisamos por correo el día antes y el día que vence.">
        <form onSubmit={submit} className="grid gap-4">
          <Field label="¿Qué tienes que pagar?" htmlFor="pay-desc" error={errors.description}>
            <Input id="pay-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Factura de bebidas" maxLength={120} className="h-10" />
          </Field>
          <Field label="Proveedor" htmlFor="pay-supplier" optional>
            <Input id="pay-supplier" list="payable-suppliers" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} maxLength={80} className="h-10" />
            <datalist id="payable-suppliers">
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto" error={errors.amount}>
              <MoneyInput value={amount} onValueChange={setAmount} currency={currency} aria-label="Monto a pagar" />
            </Field>
            <Field label="Vence el" htmlFor="pay-due" error={errors.dueDate}>
              <Input id="pay-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-10" />
            </Field>
          </div>
          <Button type="submit" size="lg" className="h-11" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Guardar pago pendiente
          </Button>
        </form>
      </AppModal>
    </>
  )
}

/** Botones de cada pago pendiente: marcar como pagado (se registra como gasto) o borrar. */
export function PayableActions({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = React.useTransition()
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await markPayablePaid(id)
            if (r.ok) toast.success(r.message ?? "Pagado")
            else toast.error(r.message)
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
        Pagado
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        className="text-muted-foreground"
        aria-label={`Borrar ${label}`}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`¿Borrar "${label}"? No se registra ningún gasto.`)) return
          startTransition(async () => {
            const r = await deletePayable(id)
            if (r.ok) toast.success(r.message ?? "Borrado")
            else toast.error(r.message)
          })
        }}
      >
        <Trash2 />
      </Button>
    </div>
  )
}
