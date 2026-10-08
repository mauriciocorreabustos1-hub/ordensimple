"use client"

import * as React from "react"
import { Check, HandCoins, Landmark, Loader2, Package, Pencil, Plus, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { createWithdrawal, payLoanInstallment, saveBalanceSettings, saveLoan } from "@/server/actions/balance"

export type WithdrawalProduct = {
  id: string
  name: string
  cost: number
  stock: number
  trackStock: boolean
}

const chip = (on: boolean) =>
  cn(
    "flex flex-1 items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-medium transition-colors hover:border-primary/50",
    on && "border-primary bg-accent text-accent-foreground ring-1 ring-primary",
  )

const DEPOSIT_IDEAS = ["Sencillo para la caja", "De mis ahorros", "Préstamo"]

/**
 * "Anotar retiro": plata que sacas para ti (de la caja o del banco) o productos que te llevas a la casa.
 * Con mode="in" es al revés, "Poner plata": lo que metes al negocio (ahorros, un préstamo, sencillo).
 */
export function WithdrawalDialog({
  currency,
  today,
  products,
  vatRate,
  mode = "out",
}: {
  mode?: "out" | "in"
  currency: string
  today: string
  products: WithdrawalProduct[]
  /** Si el negocio declara IVA: se avisa que sacar productos también lo paga. */
  vatRate: number | null
}) {
  const [open, setOpen] = React.useState(false)
  const deposit = mode === "in"
  const [kind, setKind] = React.useState<"MONEY" | "GOODS">("MONEY")
  const [amount, setAmount] = React.useState(0)
  const [source, setSource] = React.useState<"CASH" | "BANK">("CASH")
  const [productId, setProductId] = React.useState("")
  const [quantity, setQuantity] = React.useState("1")
  const [date, setDate] = React.useState(today)
  const [note, setNote] = React.useState("")
  const [pending, startTransition] = React.useTransition()
  const money = (n: number) => formatMoney(n, currency)
  const product = products.find((p) => p.id === productId)
  const qty = Math.max(0, Number(quantity.replace(/\D/g, "")) || 0)
  const goodsValue = product ? product.cost * qty : 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await createWithdrawal(
        deposit
          ? { kind: "DEPOSIT", amount, source, date, note }
          : kind === "MONEY"
            ? { kind, amount, source, date, note }
            : { kind, productId, quantity: qty, date, note },
      )
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message ?? "Retiro anotado")
      setOpen(false)
      setAmount(0)
      setProductId("")
      setQuantity("1")
      setNote("")
    })
  }

  return (
    <>
      <Button variant={deposit ? "outline" : "default"} onClick={() => setOpen(true)}>
        <Plus />
        {deposit ? "Poner plata" : "Anotar retiro"}
      </Button>
      <AppModal
        open={open}
        onOpenChange={setOpen}
        title={deposit ? "Poner plata en el negocio" : "Retiro del dueño"}
        description={
          deposit
            ? "Plata de tus ahorros, de un préstamo o sencillo para la caja. No es una venta: no sube la ganancia."
            : "Lo que sacas del negocio para ti. No es un gasto: no baja la ganancia del negocio."
        }
      >
        <form onSubmit={submit} className="grid gap-4">
          {deposit ? null : (
            <div className="flex gap-2" role="radiogroup" aria-label="Qué sacaste">
              <button
                type="button"
                role="radio"
                aria-checked={kind === "MONEY"}
                className={chip(kind === "MONEY")}
                onClick={() => setKind("MONEY")}
              >
                <Wallet className="size-4" />
                Plata
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={kind === "GOODS"}
                className={chip(kind === "GOODS")}
                onClick={() => setKind("GOODS")}
              >
                <Package className="size-4" />
                Productos
              </button>
            </div>
          )}

          {deposit || kind === "MONEY" ? (
            <>
              <Field label={deposit ? "¿Cuánto pusiste?" : "¿Cuánto sacaste?"}>
                <MoneyInput
                  value={amount}
                  onValueChange={setAmount}
                  currency={currency}
                  size="lg"
                  aria-label={deposit ? "Monto que pusiste" : "Monto del retiro"}
                  autoFocus
                />
              </Field>
              <Field label={deposit ? "¿Dónde entró?" : "¿De dónde salió?"}>
                <div className="flex gap-2" role="radiogroup" aria-label={deposit ? "Dónde entró" : "De dónde salió"}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={source === "CASH"}
                    className={chip(source === "CASH")}
                    onClick={() => setSource("CASH")}
                  >
                    <HandCoins className="size-4" />
                    {deposit ? "A la caja" : "De la caja"}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={source === "BANK"}
                    className={chip(source === "BANK")}
                    onClick={() => setSource("BANK")}
                  >
                    <Landmark className="size-4" />
                    {deposit ? "Al banco" : "Del banco"}
                  </button>
                </div>
              </Field>
              {deposit ? (
                <div className="flex flex-wrap gap-2">
                  {DEPOSIT_IDEAS.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setNote(i)}
                      className={cn(
                        "rounded-full border bg-card px-3 py-1 text-xs hover:border-primary/50",
                        note === i && "border-primary bg-accent",
                      )}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <Field label="Producto">
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger className="h-10 w-full" aria-label="Producto">
                      <SelectValue placeholder="Elige un producto" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-72">
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.trackStock ? ` · ${p.stock} en stock` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Cantidad" htmlFor="w-qty">
                  <Input
                    id="w-qty"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="tabular h-10"
                  />
                </Field>
              </div>
              {product ? (
                <p className="rounded-lg bg-muted/60 p-3 text-sm">
                  Vale <strong className="tabular">{money(goodsValue)}</strong> a lo que te costó.
                  {product.trackStock ? " Se descuenta del stock." : ""}
                  {vatRate ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Ojo: sacar productos para ti también paga IVA (aprox. {money(Math.round(goodsValue * vatRate))}). Coméntalo con tu
                      contador.
                    </span>
                  ) : null}
                </p>
              ) : null}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" htmlFor="w-date">
              <Input id="w-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
            </Field>
            <Field label="Nota" htmlFor="w-note" optional>
              <Input
                id="w-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder={deposit ? "Ej: de mis ahorros" : "Ej: sueldo de octubre"}
                className="h-10"
              />
            </Field>
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-11"
            disabled={pending || (deposit || kind === "MONEY" ? amount <= 0 : !product || qty < 1)}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {deposit ? "Guardar" : "Guardar retiro"}
          </Button>
        </form>
      </AppModal>
    </>
  )
}

/** Un monto que se guarda en la configuración del balance (plata en caja y banco, sueldo del dueño). */
export function AmountSetting({
  field,
  value,
  currency,
  label,
  button = "Guardar",
}: {
  field: "openingCash" | "ownerSalary"
  value: number | null
  currency: string
  label: string
  button?: string
}) {
  const [amount, setAmount] = React.useState(value ?? 0)
  const [pending, startTransition] = React.useTransition()
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const r = await saveBalanceSettings({ [field]: amount })
          if (r.ok) toast.success(r.message ?? "Guardado")
          else toast.error(r.message)
        })
      }}
    >
      <div className="flex-1">
        <MoneyInput value={amount} onValueChange={setAmount} currency={currency} aria-label={label} />
      </div>
      <Button type="submit" variant="outline" className="h-10" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
        {button}
      </Button>
    </form>
  )
}

export type LoanRow = {
  id: string
  lender: string
  balance: number
  installment: number | null
  dueDay: number | null
  note: string | null
}

/** Agregar o editar un préstamo o deuda del negocio. */
export function LoanDialog({ currency, loan }: { currency: string; loan?: LoanRow }) {
  const [open, setOpen] = React.useState(false)
  const [lender, setLender] = React.useState(loan?.lender ?? "")
  const [balance, setBalance] = React.useState(loan?.balance ?? 0)
  const [installment, setInstallment] = React.useState(loan?.installment ?? 0)
  const [dueDay, setDueDay] = React.useState(loan?.dueDay ? String(loan.dueDay) : "")
  const [note, setNote] = React.useState(loan?.note ?? "")
  const [received, setReceived] = React.useState<"" | "CASH" | "BANK">("")
  const [pending, startTransition] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const day = Number(dueDay.replace(/\D/g, ""))
      const r = await saveLoan(
        {
          lender,
          balance,
          installment: installment || undefined,
          dueDay: day >= 1 && day <= 31 ? day : undefined,
          note,
          receivedTo: received || undefined,
        },
        loan?.id,
      )
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message ?? "Guardado")
      setOpen(false)
      if (!loan) {
        setLender("")
        setBalance(0)
        setInstallment(0)
        setDueDay("")
        setNote("")
        setReceived("")
      }
    })
  }

  return (
    <>
      {loan ? (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={`Editar ${loan.lender}`}>
          <Pencil />
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus />
          Agregar préstamo o deuda
        </Button>
      )}
      <AppModal
        open={open}
        onOpenChange={setOpen}
        title={loan ? "Editar préstamo" : "Préstamo o deuda"}
        description="Créditos del banco, tarjeta del negocio, plata que te prestaron."
      >
        <form onSubmit={submit} className="grid gap-4">
          <Field label="¿A quién le debes?" htmlFor="l-lender">
            <Input
              id="l-lender"
              value={lender}
              onChange={(e) => setLender(e.target.value)}
              placeholder="Ej: Crédito BancoEstado, tarjeta, mi hermano"
              maxLength={80}
              className="h-10"
              autoFocus
            />
          </Field>
          <Field label="¿Cuánto debes hoy?" hint="Lo que te falta por pagar.">
            <MoneyInput value={balance} onValueChange={setBalance} currency={currency} aria-label="Saldo que debes" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cuota mensual" optional>
              <MoneyInput value={installment} onValueChange={setInstallment} currency={currency} aria-label="Cuota mensual" />
            </Field>
            <Field label="Día de pago" htmlFor="l-day" optional>
              <Input
                id="l-day"
                inputMode="numeric"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="Ej: 5"
                maxLength={2}
                className="tabular h-10"
              />
            </Field>
          </div>
          <Field label="Nota" htmlFor="l-note" optional>
            <Input id="l-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="h-10" />
          </Field>
          {loan ? null : (
            <Field
              label="¿Te acaban de pasar esta plata?"
              hint="Si es un préstamo nuevo, la plata entra a tu caja o banco. Si es una deuda antigua, déjalo en «No»."
            >
              <div className="flex gap-2" role="radiogroup" aria-label="Dónde entró la plata del préstamo">
                {(
                  [
                    ["", "No"],
                    ["BANK", "Sí, al banco"],
                    ["CASH", "Sí, a la caja"],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={received === v}
                    className={chip(received === v)}
                    onClick={() => setReceived(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Button type="submit" size="lg" className="h-11" disabled={pending || lender.trim().length < 2}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {loan ? "Guardar cambios" : "Guardar"}
          </Button>
        </form>
      </AppModal>
    </>
  )
}

/** "Pagué la cuota": baja lo que debes en el monto de la cuota. */
export function PayInstallmentButton({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = React.useTransition()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await payLoanInstallment(id)
          if (r.ok) toast.success(r.message ?? "Listo")
          else toast.error(r.message)
        })
      }
      aria-label={`Pagué la cuota de ${label}`}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Check />}
      Pagué la cuota
    </Button>
  )
}
