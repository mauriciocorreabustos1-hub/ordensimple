"use client"

import * as React from "react"
import { CheckCircle2, Loader2, MessageCircle, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { saveCashClosing } from "@/server/actions/cash"

export function CashClosingForm({
  day,
  dayLabel,
  businessName,
  currency,
  cashSales,
  cashPayments,
  expensesTotal,
  withdrawalsCash = 0,
  depositsCash = 0,
  salesTotal,
  summaryLines,
  initial,
}: {
  day: string
  dayLabel: string
  businessName: string
  currency: string
  cashSales: number
  cashPayments: number
  expensesTotal: number
  /** Retiros del dueño sacados de la caja ese día. */
  withdrawalsCash?: number
  /** Plata que el dueño puso en la caja ese día. */
  depositsCash?: number
  salesTotal: number
  /** Líneas de resumen por método de pago, para compartir por WhatsApp. */
  summaryLines: string[]
  initial?: { opening: number; counted: number; expensesFromCash: boolean; note: string }
}) {
  const money = (n: number) => formatMoney(n, currency)
  const [opening, setOpening] = React.useState(initial?.opening ?? 0)
  const [counted, setCounted] = React.useState(initial?.counted ?? 0)
  const [hasCounted, setHasCounted] = React.useState(Boolean(initial))
  const [expensesFromCash, setExpensesFromCash] = React.useState(initial?.expensesFromCash ?? false)
  const [note, setNote] = React.useState(initial?.note ?? "")
  const [pending, startTransition] = React.useTransition()

  const cashOut = expensesFromCash ? expensesTotal : 0
  const expected = opening + cashSales + cashPayments + depositsCash - cashOut - withdrawalsCash
  const difference = counted - expected

  const status =
    !hasCounted ? null : difference === 0 ? "ok" : difference > 0 ? "over" : "short"

  function save() {
    startTransition(async () => {
      const r = await saveCashClosing({ day, opening, counted, expensesFromCash, note })
      if (r.ok) toast.success(r.message ?? "Guardado")
      else toast.error(r.message)
    })
  }

  const shareText = [
    `*Cierre de caja ${businessName}*`,
    dayLabel,
    "",
    `Ventas del día: ${money(salesTotal)}`,
    ...summaryLines,
    cashPayments ? `Abonos de fiado en efectivo: ${money(cashPayments)}` : null,
    expensesFromCash && expensesTotal ? `Gastos pagados con caja: ${money(expensesTotal)}` : null,
    withdrawalsCash ? `Retiros del dueño: ${money(withdrawalsCash)}` : null,
    depositsCash ? `Plata que puso el dueño: ${money(depositsCash)}` : null,
    "",
    `Efectivo esperado: ${money(expected)}`,
    hasCounted ? `Efectivo contado: ${money(counted)}` : null,
    status === "ok" ? "✅ La caja cuadra" : status === "over" ? `Sobran ${money(difference)}` : status === "short" ? `Faltan ${money(-difference)}` : null,
    note ? `Nota: ${note}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuadrar el efectivo</CardTitle>
        <CardDescription>Cuenta los billetes y monedas de la caja y compáralos con lo que debería haber.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Field label="¿Con cuánto efectivo abriste la caja?" hint="El sencillo con que partiste el día. Si no tenías, déjalo en 0.">
          <MoneyInput value={opening} onValueChange={setOpening} currency={currency} aria-label="Efectivo inicial" />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div>
            <p className="text-sm font-medium">¿Pagaste los gastos de hoy con plata de la caja?</p>
            <p className="text-xs text-muted-foreground">
              {expensesTotal
                ? expensesFromCash
                  ? `Se descuentan ${money(expensesTotal)} del efectivo esperado.`
                  : `Hoy registraste ${money(expensesTotal)} en gastos. Actívalo solo si salieron de la caja.`
                : "Hoy no hay gastos registrados."}
            </p>
          </div>
          <Switch checked={expensesFromCash} onCheckedChange={setExpensesFromCash} aria-label="Gastos pagados con la caja" />
        </div>

        <div className="space-y-1.5 rounded-xl bg-muted/60 p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Efectivo inicial</span><span className="tabular">{money(opening)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">+ Ventas en efectivo</span><span className="tabular">{money(cashSales)}</span></div>
          {cashPayments ? (
            <div className="flex justify-between"><span className="text-muted-foreground">+ Abonos de fiado en efectivo</span><span className="tabular">{money(cashPayments)}</span></div>
          ) : null}
          {depositsCash ? (
            <div className="flex justify-between"><span className="text-muted-foreground">+ Plata que pusiste</span><span className="tabular">{money(depositsCash)}</span></div>
          ) : null}
          {cashOut ? (
            <div className="flex justify-between"><span className="text-muted-foreground">− Gastos pagados con la caja</span><span className="tabular">{money(cashOut)}</span></div>
          ) : null}
          {withdrawalsCash ? (
            <div className="flex justify-between"><span className="text-muted-foreground">− Retiros del dueño</span><span className="tabular">{money(withdrawalsCash)}</span></div>
          ) : null}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Debería haber</span>
            <span className="tabular">{money(expected)}</span>
          </div>
        </div>
        {expected < 0 ? (
          <p className="-mt-2 text-xs text-warning">
            El resultado no puede ser negativo: probablemente parte de los gastos no se pagó con la caja. Desactiva la opción
            de arriba.
          </p>
        ) : null}

        <Field label="¿Cuánto efectivo contaste?">
          <MoneyInput
            value={counted}
            onValueChange={(n) => {
              setCounted(n)
              setHasCounted(true)
            }}
            currency={currency}
            size="lg"
            aria-label="Efectivo contado"
          />
        </Field>

        {status ? (
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4",
              status === "ok" && "border-success/30 bg-success/10",
              status !== "ok" && "border-warning/40 bg-warning/10",
            )}
          >
            {status === "ok" ? (
              <CheckCircle2 className="size-6 shrink-0 text-success" />
            ) : (
              <TriangleAlert className="size-6 shrink-0 text-warning" />
            )}
            <div>
              <p className="font-semibold">
                {status === "ok" ? "¡La caja cuadra!" : status === "over" ? `Sobran ${money(difference)}` : `Faltan ${money(-difference)}`}
              </p>
              <p className="text-sm text-foreground/80">
                {status === "ok"
                  ? "El efectivo contado es exactamente lo que debería haber."
                  : status === "over"
                    ? "Hay más plata de la esperada. ¿Quedó alguna venta sin registrar?"
                    : "Hay menos plata de la esperada. Revisa si falta registrar algún gasto o si diste vuelto de más."}
              </p>
            </div>
          </div>
        ) : null}

        <Field label="Nota" htmlFor="cc-note" optional>
          <Input id="cc-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="h-10" placeholder="Ej: faltan $500 de vuelto" />
        </Field>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" className="h-11" onClick={save} disabled={pending || !hasCounted}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {initial ? "Actualizar cierre" : "Cerrar caja"}
          </Button>
          <Button size="lg" variant="outline" className="h-11" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              Compartir por WhatsApp
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
