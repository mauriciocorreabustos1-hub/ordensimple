"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, ClipboardList, Loader2, MessageCircle, Truck, X } from "lucide-react"
import { toast } from "sonner"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { AppModal } from "@/components/app/app-modal"
import { PaymentChips } from "@/components/app/payment-chips"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { orderReplyText } from "@/lib/store"
import { whatsappLink } from "@/lib/whatsapp"
import { acceptWebOrderAsComanda, acceptWebOrderAsSale, cancelWebOrder } from "@/server/actions/store"

export type WebOrderRow = {
  id: string
  code: string
  customerName: string
  customerPhone: string | null
  delivery: boolean
  note: string | null
  items: { productId: string; name: string; quantity: number; unitPrice: number }[]
  total: number
  status: "NEW" | "DONE" | "CANCELLED"
  createdAt: string
  asComanda: boolean
}

const POLL_MS = 20_000

export function WebOrdersList({
  orders,
  currency,
  timezone,
  canComanda,
  defaultPayment,
  businessName,
}: {
  orders: WebOrderRow[]
  currency: string
  timezone: string
  canComanda: boolean
  defaultPayment: PaymentMethod
  businessName: string
}) {
  const router = useRouter()
  const money = (n: number) => formatMoney(n, currency)
  const when = (iso: string) =>
    new Intl.DateTimeFormat("es-CL", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso))
  const [selling, setSelling] = React.useState<WebOrderRow | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)

  // Los pedidos nuevos aparecen solos mientras la página está abierta.
  React.useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), POLL_MS)
    return () => clearInterval(t)
  }, [router])

  async function run(id: string, action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(id)
    const r = await action()
    setBusy(null)
    if (!r.ok) toast.error(r.message)
    else toast.success(r.message)
    router.refresh()
  }

  const fresh = orders.filter((o) => o.status === "NEW")
  const past = orders.filter((o) => o.status !== "NEW")

  return (
    <div className="space-y-6">
      {fresh.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No tienes pedidos por atender. Comparte tu tienda por WhatsApp o en tus redes para recibir más.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {fresh.map((o) => (
            <li key={o.id} className="space-y-3 rounded-2xl border-2 border-primary/30 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{o.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    N.º {o.code} · {when(o.createdAt)}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {o.delivery ? (
                    <>
                      <Truck className="size-3" /> Despacho
                    </>
                  ) : (
                    "Retiro"
                  )}
                </Badge>
              </div>
              <ul className="space-y-0.5 text-sm">
                {o.items.map((i) => (
                  <li key={i.productId} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      {i.quantity} × {i.name}
                    </span>
                    <span className="tabular shrink-0 text-muted-foreground">{money(i.quantity * i.unitPrice)}</span>
                  </li>
                ))}
              </ul>
              {o.note ? <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">{o.note}</p> : null}
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="tabular text-lg font-semibold">{money(o.total)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="flex-1" onClick={() => setSelling(o)} disabled={busy === o.id}>
                  <Check />
                  Registrar venta
                </Button>
                {canComanda ? (
                  <Button variant="outline" className="flex-1" onClick={() => void run(o.id, () => acceptWebOrderAsComanda(o.id))} disabled={busy === o.id}>
                    <ClipboardList />
                    Abrir comanda
                  </Button>
                ) : null}
                {o.customerPhone ? (
                  <Button variant="outline" size="icon" asChild aria-label={`Escribirle a ${o.customerName} por WhatsApp`}>
                    <a href={whatsappLink(o.customerPhone, orderReplyText(o.customerName, o.code, businessName))} target="_blank" rel="noopener noreferrer">
                      <MessageCircle />
                    </a>
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  aria-label="Descartar pedido"
                  title="Descartar (no se concretó)"
                  onClick={() => void run(o.id, () => cancelWebOrder(o.id))}
                  disabled={busy === o.id}
                >
                  {busy === o.id ? <Loader2 className="animate-spin" /> : <X />}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {past.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Atendidos en los últimos 7 días</p>
          <ul className="divide-y rounded-xl border bg-card">
            {past.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  {o.customerName} <span className="text-muted-foreground">· n.º {o.code} · {when(o.createdAt)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular">{money(o.total)}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      o.status === "DONE" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {o.status === "DONE" ? (o.asComanda ? "Comanda" : "Vendido") : "Descartado"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {selling ? (
        <SellDialog
          order={selling}
          money={money}
          defaultPayment={defaultPayment}
          onClose={() => setSelling(null)}
          onDone={() => {
            setSelling(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function SellDialog({
  order,
  money,
  defaultPayment,
  onClose,
  onDone,
}: {
  order: WebOrderRow
  money: (n: number) => string
  defaultPayment: PaymentMethod
  onClose: () => void
  onDone: () => void
}) {
  const [payment, setPayment] = React.useState<PaymentMethod>(defaultPayment === "FIADO" ? "CASH" : defaultPayment)
  const [pending, startTransition] = React.useTransition()
  function confirm() {
    startTransition(async () => {
      const r = await acceptWebOrderAsSale(order.id, payment)
      if (!r.ok) return void toast.error(r.message)
      toast.success(`${r.message}: ${money(order.total)}`)
      onDone()
    })
  }
  return (
    <AppModal open onOpenChange={(o) => !o && onClose()} title={`Venta: pedido de ${order.customerName}`} description={`Total ${money(order.total)}. Se descuenta el stock y suma a la caja de hoy.`} noAutoFocus>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">¿Cómo te pagó?</p>
          <PaymentChips value={payment} onChange={setPayment} allowFiado={false} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Volver
          </Button>
          <Button onClick={confirm} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />}
            Registrar venta
          </Button>
        </div>
      </div>
    </AppModal>
  )
}
