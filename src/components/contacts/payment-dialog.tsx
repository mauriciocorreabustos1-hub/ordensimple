"use client"

import * as React from "react"
import { HandCoins, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { PaymentChips } from "@/components/app/payment-chips"
import { formatMoney } from "@/lib/currency"
import { toDateKey } from "@/lib/dates"
import { createCustomerPayment } from "@/server/actions/fiado"

/** "Registrar abono": el cliente paga todo o parte de lo que debe. */
export function PaymentDialog({
  customerId,
  customerName,
  balance,
  currency,
  timezone,
  compact = false,
}: {
  customerId: string
  customerName: string
  balance: number
  currency: string
  timezone: string
  compact?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [amount, setAmount] = React.useState(balance)
  const [method, setMethod] = React.useState<PaymentMethod>("CASH")
  const [date, setDate] = React.useState(() => toDateKey(new Date(), timezone))
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | undefined>()
  const [pending, startTransition] = React.useTransition()
  const money = (n: number) => formatMoney(n, currency)

  function openDialog() {
    setAmount(balance)
    setError(undefined)
    setOpen(true)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (amount <= 0) return setError("Ingresa cuánto te pagó")
    if (amount > balance) return setError(`Te debe ${money(balance)}; el abono no puede ser mayor`)
    startTransition(async () => {
      const paymentMethod = method === "FIADO" ? "CASH" : method
      const r = await createCustomerPayment({ customerId, amount, date, paymentMethod, note })
      if (!r.ok) return void toast.error(r.message)
      toast.success(
        amount === balance ? `${customerName} quedó al día` : `Abono de ${money(amount)} registrado. Le quedan ${money(balance - amount)}`,
      )
      setOpen(false)
      setNote("")
    })
  }

  return (
    <>
      <Button size={compact ? "sm" : "lg"} variant={compact ? "outline" : "default"} className={compact ? "" : "h-10 px-4"} onClick={openDialog}>
        <HandCoins />
        Registrar abono
      </Button>
      <AppModal
        open={open}
        onOpenChange={setOpen}
        title={`Abono de ${customerName}`}
        description={`Te debe ${money(balance)}. Registra cuánto te pagó.`}
      >
        <form onSubmit={submit} className="grid gap-5">
          <Field label="¿Cuánto te pagó?" error={error}>
            <MoneyInput value={amount} onValueChange={setAmount} currency={currency} size="lg" autoFocus aria-label="Monto del abono" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setAmount(balance)}>
              Todo ({money(balance)})
            </Button>
            {balance >= 2 ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setAmount(Math.round(balance / 2))}>
                La mitad
              </Button>
            ) : null}
          </div>
          <Field label="¿Cómo te pagó?">
            <PaymentChips value={method} onChange={setMethod} allowFiado={false} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" htmlFor="ab-date">
              <Input id="ab-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
            </Field>
            <Field label="Nota" htmlFor="ab-note" optional>
              <Input id="ab-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="h-10" />
            </Field>
          </div>
          {amount > 0 && amount <= balance ? (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm">
              {amount === balance
                ? `${customerName} quedará al día.`
                : `Después de este abono le quedarán ${money(balance - amount)} por pagar.`}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Registrar abono
          </Button>
        </form>
      </AppModal>
    </>
  )
}
