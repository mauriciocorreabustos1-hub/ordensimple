"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { PaymentChips } from "@/components/app/payment-chips"
import { formatMoney } from "@/lib/currency"
import { toDateKey } from "@/lib/dates"
import { createQuickSale } from "@/server/actions/sales"

export function QuickSaleForm({
  currency,
  timezone,
  defaultPayment,
  onDone,
}: {
  currency: string
  timezone: string
  defaultPayment: PaymentMethod
  onDone?: () => void
}) {
  const [amount, setAmount] = React.useState(0)
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(defaultPayment)
  const [date, setDate] = React.useState(() => toDateKey(new Date(), timezone))
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (amount <= 0) {
      setError("Ingresa el monto de la venta")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createQuickSale({ amount, paymentMethod, date, note })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`Venta de ${formatMoney(amount, currency)} guardada`)
      setAmount(0)
      setNote("")
      onDone?.()
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Field label="¿Cuánto vendiste?" error={error ?? undefined}>
        <MoneyInput value={amount} onValueChange={setAmount} currency={currency} size="lg" autoFocus aria-label="Monto" />
      </Field>
      <Field label="¿Cómo te pagaron?">
        <PaymentChips value={paymentMethod} onChange={setPaymentMethod} />
      </Field>
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
        Guardar venta
      </Button>
    </form>
  )
}
