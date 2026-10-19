"use client"

import * as React from "react"
import { Check, Loader2, Percent, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/currency"
import { decideDiscount, listPendingDiscounts, type PendingDiscount } from "@/server/actions/discounts"

const POLL_MS = 6000

/**
 * Para el dueño y los administradores de un negocio con equipo: cuando un trabajador pide un descuento,
 * aparece aquí para aprobarlo o rechazarlo. Se consulta sola mientras la app está abierta.
 */
export function DiscountApprovals({ currency }: { currency: string }) {
  const money = (n: number) => formatMoney(n, currency)
  const [items, setItems] = React.useState<PendingDiscount[]>([])
  const [busy, setBusy] = React.useState<string | null>(null)
  const seen = React.useRef(new Set<string>())

  React.useEffect(() => {
    let alive = true
    async function load() {
      if (document.visibilityState !== "visible") return
      const r = await listPendingDiscounts()
      if (!alive || !r.ok || !r.data) return
      const fresh = r.data.filter((d) => !seen.current.has(d.id))
      if (fresh.length) {
        fresh.forEach((d) => seen.current.add(d.id))
        // Vibración corta en el celular para que no pase desapercibido.
        navigator.vibrate?.(200)
      }
      setItems(r.data)
    }
    void load()
    const t = setInterval(() => void load(), POLL_MS)
    document.addEventListener("visibilitychange", load)
    return () => {
      alive = false
      clearInterval(t)
      document.removeEventListener("visibilitychange", load)
    }
  }, [])

  async function decide(d: PendingDiscount, approve: boolean) {
    setBusy(d.id)
    const r = await decideDiscount(d.id, approve)
    setBusy(null)
    if (!r.ok) toast.error(r.message)
    else toast.success(`${approve ? "Aprobaste" : "Rechazaste"} el descuento de ${d.requestedByName}`)
    setItems((list) => list.filter((x) => x.id !== d.id))
  }

  if (!items.length) return null
  return (
    <div className="fixed inset-x-3 bottom-24 z-50 flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96" role="region" aria-label="Descuentos por aprobar">
      {items.slice(0, 3).map((d) => {
        const pct = Math.round((d.amount / d.subtotal) * 1000) / 10
        return (
          <div key={d.id} className="rounded-2xl border-2 border-primary/40 bg-background p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Percent className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{d.requestedByName}</span> pide un descuento
                </p>
                <p className="tabular mt-0.5 text-xl font-semibold">
                  −{money(d.amount)} <span className="text-sm font-medium text-muted-foreground">({pct}%)</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.context} · sobre {money(d.subtotal)} · queda en {money(d.subtotal - d.amount)}
                </p>
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Motivo:</span> {d.reason}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => void decide(d, false)} disabled={busy === d.id}>
                <X />
                Rechazar
              </Button>
              <Button onClick={() => void decide(d, true)} disabled={busy === d.id}>
                {busy === d.id ? <Loader2 className="animate-spin" /> : <Check />}
                Aprobar
              </Button>
            </div>
          </div>
        )
      })}
      {items.length > 3 ? <p className="rounded-lg bg-background/95 px-3 py-1.5 text-center text-xs text-muted-foreground shadow">Y {items.length - 3} más esperando</p> : null}
    </div>
  )
}
