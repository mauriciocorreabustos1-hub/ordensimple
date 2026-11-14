"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Minus, Plus, Undo2 } from "lucide-react"
import { toast } from "sonner"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { AppModal } from "@/components/app/app-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { allowsDecimals, formatQuantity, roundQuantity, SALE_UNIT_INFO, saleUnitOf } from "@/lib/units"
import { QuantityInput } from "@/components/app/quantity-input"
import { getReturnable, requestReturn, type ReturnableSale } from "@/server/actions/returns"

const REASONS = ["Producto en mal estado", "Se equivocó de producto", "El cliente se arrepintió", "Cobro duplicado"]
const REFUNDS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Efectivo" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "DEBIT", label: "Débito" },
  { value: "CREDIT", label: "Crédito" },
]

/** Botón "Devolver" de una venta: el empleado la pide (la aprueba el encargado); el dueño o un administrador la hace directo. */
export function ReturnButton({ saleId, currency, timezone, canApprove }: { saleId: string; currency: string; timezone: string; canApprove: boolean }) {
  const router = useRouter()
  const money = (n: number) => formatMoney(n, currency)
  const [open, setOpen] = React.useState(false)
  const [data, setData] = React.useState<ReturnableSale | null>(null)
  const [qty, setQty] = React.useState<Record<string, number>>({})
  const [reason, setReason] = React.useState("")
  const [refund, setRefund] = React.useState<PaymentMethod>("CASH")
  const [restock, setRestock] = React.useState(true)
  const [pending, startTransition] = React.useTransition()

  async function openDialog() {
    setOpen(true)
    setData(null)
    const r = await getReturnable(saleId)
    if (!r.ok || !r.data) {
      toast.error(r.ok ? "No se pudo cargar la venta." : r.message)
      setOpen(false)
      return
    }
    setData(r.data)
    // Si la venta tiene un solo producto, se marca entero de una vez.
    setQty(r.data.items.length === 1 ? { [r.data.items[0].saleItemId]: r.data.items[0].available } : {})
    setRefund(r.data.paymentMethod === "FIADO" ? "FIADO" : r.data.paymentMethod === "OTHER" ? "CASH" : r.data.paymentMethod)
    setReason("")
    setRestock(true)
  }

  const lines = data ? data.items.filter((i) => (qty[i.saleItemId] ?? 0) > 0) : []
  const amount = data ? Math.round(lines.reduce((s, i) => s + (qty[i.saleItemId] ?? 0) * i.unitPrice, 0) * data.ratio) : 0
  const nothingLeft = data !== null && data.items.every((i) => i.available === 0)

  function submit() {
    if (!data || !lines.length) return toast.error("Elige qué productos se devuelven.")
    if (reason.trim().length < 2) return toast.error("Escribe el motivo de la devolución.")
    startTransition(async () => {
      const r = await requestReturn({
        saleId,
        items: lines.map((i) => ({ saleItemId: i.saleItemId, quantity: qty[i.saleItemId] })),
        reason: reason.trim(),
        refundMethod: refund,
        restock,
      })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.data?.applied ? `Devolución de ${money(amount)} registrada` : `Devolución de ${money(amount)} pedida: el encargado debe aprobarla`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Devolver" title="Devolver" onClick={() => void openDialog()} className="text-muted-foreground hover:text-foreground">
        <Undo2 />
      </Button>
      <AppModal open={open} onOpenChange={setOpen} title="Devolución" description={data ? `Venta del ${formatDate(new Date(data.date), timezone, { day: "numeric", month: "long" })}${data.customerName ? ` · ${data.customerName}` : ""}` : undefined}>
        {!data ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : data.tooOld ? (
          <p className="text-sm text-muted-foreground">Esta venta tiene más de 30 días. Para devolverla, pídele al encargado que lo haga.</p>
        ) : nothingLeft ? (
          <p className="text-sm text-muted-foreground">
            {data.hasPending ? "Ya hay una devolución pendiente de aprobación por todo lo de esta venta." : "Todo lo de esta venta ya fue devuelto."}
          </p>
        ) : (
          <div className="space-y-5">
            {data.hasPending ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Esta venta ya tiene una devolución esperando aprobación.</p> : null}
            <div className="space-y-2">
              <p className="text-sm font-medium">¿Qué se devuelve?</p>
              <ul className="divide-y rounded-xl border">
                {data.items.map((i) => {
                  const q = qty[i.saleItemId] ?? 0
                  const set = (n: number) => setQty((m) => ({ ...m, [i.saleItemId]: roundQuantity(Math.max(0, Math.min(i.available, n)), i.unit) }))
                  return (
                    <li key={i.saleItemId} className={cn("flex items-center gap-3 p-3", i.available === 0 && "opacity-50")}>
                      <span className="min-w-0 flex-1 text-sm leading-snug">
                        {i.description}
                        <span className="block text-xs text-muted-foreground">
                          {money(i.unitPrice)} {allowsDecimals(i.unit) ? `el ${SALE_UNIT_INFO[saleUnitOf(i.unit)].per}` : "c/u"} ·{" "}
                          {i.available === i.sold
                            ? `vendiste ${formatQuantity(i.sold, i.unit)}`
                            : `quedan ${formatQuantity(i.available, i.unit)} de ${formatQuantity(i.sold, i.unit)} por devolver`}
                        </span>
                      </span>
                      {allowsDecimals(i.unit) ? (
                        <QuantityInput
                          unit={i.unit}
                          value={q}
                          onValueChange={set}
                          disabled={i.available === 0}
                          aria-label={`Cuánto se devuelve de ${i.description}`}
                          className="w-28"
                        />
                      ) : (
                      <div className="flex items-center rounded-lg border">
                        <button type="button" className="flex size-9 items-center justify-center disabled:opacity-40" aria-label="Uno menos" disabled={q <= 0} onClick={() => set(q - 1)}>
                          <Minus className="size-3.5" />
                        </button>
                        <span className="tabular w-7 text-center text-sm font-semibold">{q}</span>
                        <button type="button" className="flex size-9 items-center justify-center disabled:opacity-40" aria-label="Uno más" disabled={q >= i.available} onClick={() => set(q + 1)}>
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Motivo</p>
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={cn("h-8 rounded-full border bg-background px-3 text-xs font-medium hover:border-primary/50", reason === r && "border-primary bg-primary text-primary-foreground")}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 80))} placeholder="U otro motivo" className="h-10" aria-label="Motivo de la devolución" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">¿Cómo se devuelve el dinero?</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(data.paymentMethod === "FIADO" ? [{ value: "FIADO" as PaymentMethod, label: "Rebajar del fiado" }, ...REFUNDS] : REFUNDS).map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setRefund(m.value)}
                    className={cn("h-10 rounded-xl border bg-card px-2 text-xs font-medium hover:border-primary/50", refund === m.value && "border-primary bg-accent text-accent-foreground ring-1 ring-primary")}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">¿El producto vuelve a la venta?</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: true, t: "Sí, vuelve al stock", d: "Está en buen estado" },
                  { v: false, t: "No, está dañado", d: "Se anota como merma" },
                ].map((o) => (
                  <button
                    key={String(o.v)}
                    type="button"
                    onClick={() => setRestock(o.v)}
                    className={cn("rounded-xl border bg-card p-3 text-left hover:border-primary/50", restock === o.v && "border-primary bg-accent ring-1 ring-primary")}
                  >
                    <span className="block text-sm font-medium">{o.t}</span>
                    <span className="block text-xs text-muted-foreground">{o.d}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-sm text-muted-foreground">{refund === "FIADO" ? "Se rebaja del fiado" : "A devolver"}</span>
              <span className="tabular text-xl font-semibold">{money(amount)}</span>
            </div>
            {data.ratio < 1 ? <p className="-mt-3 text-xs text-muted-foreground">La venta tuvo descuento: se devuelve lo que realmente se pagó.</p> : null}

            <Button size="lg" className="h-12 w-full" onClick={submit} disabled={pending || !lines.length}>
              {pending ? <Loader2 className="animate-spin" /> : <Undo2 />}
              {canApprove ? "Hacer la devolución" : "Pedir aprobación al encargado"}
            </Button>
          </div>
        )}
      </AppModal>
    </>
  )
}
