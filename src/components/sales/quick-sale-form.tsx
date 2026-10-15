"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { GUIDE_SALE_SAVED } from "@/components/app/guided-tour"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { PaymentChips } from "@/components/app/payment-chips"
import { formatMoney } from "@/lib/currency"
import { toDateKey } from "@/lib/dates"
import { createQuickSale, updateQuickSale } from "@/server/actions/sales"
import { useOfflineSales } from "@/components/app/offline-sales"

export type QuickSaleEdit = {
  id: string
  amount: number
  paymentMethod: PaymentMethod
  date: string
  customerName: string
  note: string
}

export function QuickSaleForm({
  currency,
  timezone,
  defaultPayment,
  customers = [],
  editing,
  onDone,
}: {
  currency: string
  timezone: string
  defaultPayment: PaymentMethod
  customers?: string[]
  /** Si viene, el formulario edita esa venta en vez de crear una nueva. */
  editing?: QuickSaleEdit
  onDone?: () => void
}) {
  const [amount, setAmount] = React.useState(editing?.amount ?? 0)
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(editing?.paymentMethod ?? defaultPayment)
  const [date, setDate] = React.useState(() => editing?.date ?? toDateKey(new Date(), timezone))
  const [customerName, setCustomerName] = React.useState(editing?.customerName ?? "")
  const [note, setNote] = React.useState(editing?.note ?? "")
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({})
  const [pending, startTransition] = React.useTransition()
  const offline = useOfflineSales()
  const fiado = paymentMethod === "FIADO"

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (amount <= 0) errs.amount = "Ingresa el monto de la venta"
    if (fiado && !customerName.trim()) errs.customerName = "¿A quién le fiaste? Escribe su nombre"
    setErrors(errs)
    if (Object.keys(errs).length) return
    startTransition(async () => {
      const input = { amount, paymentMethod, date, customerName, note }
      const result = editing
        ? await updateQuickSale(editing.id, input)
        : offline
          ? await offline.save({ kind: "quick", input, total: amount })
          : await createQuickSale(input)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(
        "offline" in result && result.offline
          ? `Sin internet: la venta de ${formatMoney(amount, currency)} quedó guardada en este equipo y se subirá sola.`
          : editing
            ? "Venta actualizada"
            : fiado
              ? `Fiado de ${formatMoney(amount, currency)} anotado a ${customerName}`
              : `Venta de ${formatMoney(amount, currency)} guardada`,
      )
      if (!editing) {
        window.dispatchEvent(new Event(GUIDE_SALE_SAVED))
        setAmount(0)
        setNote("")
        setCustomerName("")
      }
      onDone?.()
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Field label="¿Cuánto vendiste?" error={errors.amount}>
        <MoneyInput value={amount} onValueChange={setAmount} currency={currency} size="lg" autoFocus aria-label="Monto" />
      </Field>
      <Field label="¿Cómo te pagaron?">
        <PaymentChips value={paymentMethod} onChange={setPaymentMethod} />
      </Field>
      {fiado ? (
        <Field
          label="¿A quién le fiaste?"
          htmlFor="qs-customer"
          error={errors.customerName}
          hint="Quedará anotado lo que te debe en Clientes."
        >
          <Input
            id="qs-customer"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={80}
            className="h-10"
            placeholder="Nombre del cliente"
            list="qs-customers"
            autoComplete="off"
          />
          <datalist id="qs-customers">
            {customers.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" htmlFor="qs-date">
          <Input id="qs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
        </Field>
        <Field label="Nota" htmlFor="qs-note" optional>
          <Input id="qs-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="h-10" />
        </Field>
      </div>
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {editing ? "Guardar cambios" : fiado ? "Anotar fiado" : "Guardar venta"}
      </Button>
    </form>
  )
}
