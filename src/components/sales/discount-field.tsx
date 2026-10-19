"use client"

import * as React from "react"
import { Check, Loader2, Percent, X } from "lucide-react"
import { toast } from "sonner"
import { MoneyInput } from "@/components/app/money-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { getDiscountStatus, requestDiscount, withdrawDiscount } from "@/server/actions/discounts"

/** Lo que el formulario necesita para guardar la venta con descuento. */
export type DiscountValue = { discount: number; discountReason?: string; discountRequestId?: string }

const PERCENTS = [5, 10, 15, 20]
const REASONS = ["Cliente frecuente", "Producto dañado", "Promoción", "Error en el pedido"]

type Request = { id: string; amount: number; subtotal: number; status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "USED"; by: string | null }

/**
 * Descuento sobre el total. El dueño o un administrador lo aplica directo; un empleado lo pide y espera la
 * aprobación (se consulta sola cada pocos segundos). Avisa al formulario con `onChange`:
 * - `value`: lo que se puede guardar ahora (null = sin descuento utilizable).
 * - `blocked`: hay un descuento escrito pero todavía no se puede usar (falta aprobación).
 */
export function DiscountField({
  subtotal,
  context,
  canApprove,
  currency,
  onChange,
}: {
  subtotal: number
  context: string
  canApprove: boolean
  currency: string
  onChange: (state: { value: DiscountValue | null; blocked: string | null }) => void
}) {
  const money = (n: number) => formatMoney(n, currency)
  const [open, setOpen] = React.useState(false)
  const [amount, setAmount] = React.useState(0)
  const [reason, setReason] = React.useState("")
  const [request, setRequest] = React.useState<Request | null>(null)
  const [asking, setAsking] = React.useState(false)

  // Si cambió el monto o el total desde que se pidió, la aprobación ya no sirve.
  const stale = request !== null && (request.amount !== amount || request.subtotal !== subtotal)
  const tooBig = amount >= subtotal && amount > 0

  // Se le cuenta al formulario qué descuento puede guardar.
  const report = React.useRef(onChange)
  React.useEffect(() => {
    report.current = onChange
  })
  React.useEffect(() => {
    if (!open || amount <= 0) return report.current({ value: null, blocked: null })
    if (tooBig) return report.current({ value: null, blocked: "El descuento no puede ser igual o mayor que el total." })
    if (canApprove) return report.current({ value: { discount: amount, discountReason: reason.trim() || undefined }, blocked: null })
    if (request && !stale && request.status === "APPROVED") {
      return report.current({ value: { discount: amount, discountReason: reason.trim(), discountRequestId: request.id }, blocked: null })
    }
    report.current({ value: null, blocked: request?.status === "PENDING" && !stale ? "Espera la aprobación del descuento o quítalo." : "Pide la aprobación del descuento o quítalo." })
  }, [open, amount, reason, canApprove, request, stale, tooBig])

  // Mientras espera respuesta, consulta cada 3 segundos.
  React.useEffect(() => {
    if (!request || request.status !== "PENDING" || stale) return
    const t = setInterval(async () => {
      const r = await getDiscountStatus(request.id)
      if (!r.ok || !r.data || r.data.status === "PENDING") return
      const { status, decidedByName } = r.data
      setRequest((cur) => (cur && cur.id === request.id ? { ...cur, status, by: decidedByName } : cur))
      if (status === "APPROVED") toast.success(`Descuento aprobado por ${decidedByName ?? "el encargado"}`)
      if (status === "REJECTED") toast.error(`Descuento rechazado por ${decidedByName ?? "el encargado"}`)
    }, 3000)
    return () => clearInterval(t)
  }, [request, stale])

  async function ask() {
    if (amount <= 0 || reason.trim().length < 2) return toast.error("Escribe el monto y el motivo del descuento.")
    setAsking(true)
    if (request) void withdrawDiscount(request.id)
    const r = await requestDiscount({ amount, subtotal, reason: reason.trim(), context })
    setAsking(false)
    if (!r.ok || !r.data) return toast.error(r.ok ? "No se pudo pedir el descuento." : r.message)
    setRequest({ id: r.data.id, amount, subtotal, status: "PENDING", by: null })
  }

  function remove() {
    if (request && request.status !== "USED") void withdrawDiscount(request.id)
    setRequest(null)
    setAmount(0)
    setReason("")
    setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline">
        <Percent className="size-4" />
        Agregar descuento
      </button>
    )
  }

  const pct = subtotal > 0 && amount > 0 ? Math.round((amount / subtotal) * 1000) / 10 : 0
  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-accent/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Descuento</p>
        <button type="button" onClick={remove} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
          Quitar
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MoneyInput value={amount} onValueChange={setAmount} currency={currency} aria-label="Monto del descuento" className="w-36 [&_input]:bg-background" />
        {PERCENTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(Math.round((subtotal * p) / 100))}
            className={cn("h-9 rounded-full border bg-background px-3 text-xs font-medium hover:border-primary/50", pct === p && "border-primary bg-primary text-primary-foreground")}
          >
            {p}%
          </button>
        ))}
      </div>
      {amount > 0 ? (
        <p className={cn("text-xs", tooBig ? "text-destructive" : "text-muted-foreground")}>
          {tooBig ? "El descuento no puede ser igual o mayor que el total." : `${pct}% de ${money(subtotal)} · queda en ${money(subtotal - amount)}`}
        </p>
      ) : null}
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 80))}
        placeholder={canApprove ? "Motivo (opcional)" : "Motivo: cliente frecuente, producto dañado…"}
        list="discount-reasons"
        className="h-10 bg-background"
        aria-label="Motivo del descuento"
      />
      <datalist id="discount-reasons">
        {REASONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      {canApprove ? (
        <p className="text-xs text-muted-foreground">Como encargado, el descuento se aplica al guardar.</p>
      ) : request && !stale && request.status === "PENDING" ? (
        <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="flex-1">Esperando la aprobación del encargado…</span>
        </div>
      ) : request && !stale && request.status === "APPROVED" ? (
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
          <Check className="size-4" />
          Aprobado por {request.by ?? "el encargado"}
        </div>
      ) : (
        <div className="space-y-2">
          {request && !stale && request.status === "REJECTED" ? (
            <p className="text-xs text-destructive">Rechazado por {request.by ?? "el encargado"}. Puedes cobrar sin descuento o pedirlo de nuevo.</p>
          ) : request && (stale || request.status === "EXPIRED") ? (
            <p className="text-xs text-muted-foreground">La venta cambió o la aprobación venció: pídela de nuevo.</p>
          ) : null}
          <Button type="button" variant="outline" className="w-full" onClick={() => void ask()} disabled={asking || amount <= 0 || tooBig || reason.trim().length < 2}>
            {asking ? <Loader2 className="animate-spin" /> : null}
            Pedir aprobación al encargado
          </Button>
        </div>
      )}
    </div>
  )
}
