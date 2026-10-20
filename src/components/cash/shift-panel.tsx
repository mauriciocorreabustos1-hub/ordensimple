"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Clock, Loader2, LockOpen, Lock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { closeShift, openShift } from "@/server/actions/cash"

export type OpenShift = {
  id: string
  openedBy: string
  openedAt: string
  opening: number
  salesTotal: number
  salesCount: number
  cashSales: number
  cashPayments: number
  expensesTotal: number
  withdrawalsCash: number
  depositsCash: number
}

export type ClosedShift = {
  id: string
  openedBy: string
  closedBy: string
  openedAt: string
  closedAt: string
  salesTotal: number
  expected: number
  counted: number
  difference: number
  note: string | null
}

/** Turnos de caja: quien entra abre con el sencillo y al salir cuenta el efectivo. Cada turno cuadra por separado. */
export function ShiftPanel({
  open,
  shifts,
  lastCounted,
  currency,
  timezone,
  isToday,
}: {
  open: OpenShift | null
  shifts: ClosedShift[]
  lastCounted: number | null
  currency: string
  timezone: string
  isToday: boolean
}) {
  const money = (n: number) => formatMoney(n, currency)
  const time = (iso: string) => new Intl.DateTimeFormat("es-CL", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso))
  if (!isToday && !shifts.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5 text-primary" />
          Turnos de caja
        </CardTitle>
        <CardDescription>Si trabajan por turnos, cada persona abre con el sencillo y al salir cuenta la plata. Así sabes en qué turno faltó o sobró.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isToday ? open ? <CloseForm shift={open} money={money} time={time} currency={currency} /> : <OpenForm lastCounted={lastCounted} currency={currency} /> : null}
        {shifts.length ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Turnos cerrados {isToday ? "hoy" : "ese día"}</p>
            <ul className="divide-y rounded-xl border">
              {shifts.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {time(s.openedAt)} – {time(s.closedAt)} · {s.openedBy}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vendió {money(s.salesTotal)} · contó {money(s.counted)}
                      {s.closedBy !== s.openedBy ? ` · cerró ${s.closedBy}` : ""}
                      {s.note ? ` · ${s.note}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "tabular shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      s.difference === 0 ? "bg-success/15 text-success" : "bg-warning/15 text-foreground",
                    )}
                  >
                    {s.difference === 0 ? "Cuadró" : s.difference > 0 ? `Sobró ${money(s.difference)}` : `Faltó ${money(-s.difference)}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function OpenForm({ lastCounted, currency }: { lastCounted: number | null; currency: string }) {
  const router = useRouter()
  const [opening, setOpening] = React.useState(lastCounted ?? 0)
  const [pending, startTransition] = React.useTransition()
  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await openShift({ opening })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message ?? "Turno abierto")
      router.refresh()
    })
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-xl bg-muted/50 p-4">
      <Field
        label="¿Con cuánto efectivo empiezas el turno?"
        hint={lastCounted !== null ? "Te pusimos lo que se contó al cerrar el turno anterior." : "El sencillo que hay en la caja."}
        className="min-w-0 flex-1 basis-56"
      >
        <MoneyInput value={opening} onValueChange={setOpening} currency={currency} aria-label="Efectivo al abrir el turno" className="[&_input]:bg-background" />
      </Field>
      <Button type="submit" disabled={pending} className="max-sm:w-full">
        {pending ? <Loader2 className="animate-spin" /> : <LockOpen />}
        Abrir turno
      </Button>
    </form>
  )
}

function CloseForm({
  shift,
  money,
  time,
  currency,
}: {
  shift: OpenShift
  money: (n: number) => string
  time: (iso: string) => string
  currency: string
}) {
  const router = useRouter()
  const [counted, setCounted] = React.useState(0)
  const [hasCounted, setHasCounted] = React.useState(false)
  const [expensesFromCash, setExpensesFromCash] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [pending, startTransition] = React.useTransition()
  const cashOut = expensesFromCash ? shift.expensesTotal : 0
  const expected = shift.opening + shift.cashSales + shift.cashPayments + shift.depositsCash - cashOut - shift.withdrawalsCash
  const difference = counted - expected

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasCounted) return void toast.error("Escribe cuánto efectivo contaste.")
    startTransition(async () => {
      const r = await closeShift({ shiftId: shift.id, counted, expensesFromCash, note })
      if (!r.ok) return void toast.error(r.message)
      const d = r.data?.difference ?? 0
      toast.success(d === 0 ? "Turno cerrado: la caja cuadra" : d > 0 ? `Turno cerrado: sobran ${money(d)}` : `Turno cerrado: faltan ${money(-d)}`)
      router.refresh()
    })
  }

  const line = (label: string, value: number) => (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular">{money(value)}</span>
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border-2 border-primary/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          Turno abierto por {shift.openedBy} a las {time(shift.openedAt)}
        </p>
        <p className="text-sm text-muted-foreground">
          {shift.salesCount} {shift.salesCount === 1 ? "venta" : "ventas"} · {money(shift.salesTotal)}
        </p>
      </div>
      <div className="space-y-1.5 rounded-xl bg-muted/60 p-4 text-sm">
        {line("Efectivo al abrir", shift.opening)}
        {line("+ Ventas en efectivo", shift.cashSales)}
        {shift.cashPayments ? line("+ Abonos de fiado en efectivo", shift.cashPayments) : null}
        {shift.depositsCash ? line("+ Plata que puso el dueño", shift.depositsCash) : null}
        {cashOut ? line("− Gastos pagados con la caja", cashOut) : null}
        {shift.withdrawalsCash ? line("− Retiros del dueño", shift.withdrawalsCash) : null}
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <span>Debería haber</span>
          <span className="tabular">{money(expected)}</span>
        </div>
      </div>
      {shift.expensesTotal ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <p className="text-sm">
            En este turno se anotaron {money(shift.expensesTotal)} en gastos. ¿Salieron de la caja?
          </p>
          <Switch checked={expensesFromCash} onCheckedChange={setExpensesFromCash} aria-label="Gastos del turno pagados con la caja" />
        </div>
      ) : null}
      <Field label="¿Cuánto efectivo contaste al cerrar?">
        <MoneyInput
          value={counted}
          onValueChange={(n) => {
            setCounted(n)
            setHasCounted(true)
          }}
          currency={currency}
          size="lg"
          aria-label="Efectivo contado al cerrar el turno"
        />
      </Field>
      {hasCounted ? (
        <p
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium",
            difference === 0 ? "bg-success/15 text-success" : "bg-warning/15",
          )}
        >
          {difference === 0 ? "La caja cuadra" : difference > 0 ? `Sobran ${money(difference)}` : `Faltan ${money(-difference)}`}
        </p>
      ) : null}
      <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Nota (opcional)" aria-label="Nota del turno" />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <Lock />}
        Cerrar turno
      </Button>
    </form>
  )
}
