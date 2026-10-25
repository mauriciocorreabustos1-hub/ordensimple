"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, ClipboardList, Link2, Loader2, MessageCircle, Trash2, Truck, X } from "lucide-react"
import { toast } from "sonner"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { AppModal } from "@/components/app/app-modal"
import { PaymentChips } from "@/components/app/payment-chips"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { ORDER_STAGES, orderReplyText, orderStageLabel, orderStageText, orderTrackPath, type OrderStage } from "@/lib/store"
import { whatsappLink } from "@/lib/whatsapp"
import { ConfirmDelete } from "@/components/app/confirm-delete"
import { acceptWebOrderAsComanda, acceptWebOrderAsSale, cancelWebOrder, deleteWebOrders, setWebOrderStage } from "@/server/actions/store"

export type WebOrderRow = {
  id: string
  code: string
  customerName: string
  customerPhone: string | null
  delivery: boolean
  /** Mesa desde la que pidieron con la carta QR. */
  table: string | null
  note: string | null
  items: { productId: string; name: string; quantity: number; unitPrice: number }[]
  total: number
  status: "NEW" | "DONE" | "CANCELLED"
  createdAt: string
  asComanda: boolean
  promoDiscount: number
  couponCode: string | null
  couponDiscount: number
  /** Enlace de seguimiento que ve el cliente. */
  trackToken: string
  stage: OrderStage
}

const trackUrl = (o: WebOrderRow) => `${window.location.origin}${orderTrackPath(o.trackToken)}`

const POLL_MS = 20_000

export function WebOrdersList({
  orders,
  currency,
  timezone,
  canComanda,
  defaultPayment,
  businessName,
  canDelete = false,
}: {
  /** Puede eliminar pedidos (permiso de eliminar ventas). */
  canDelete?: boolean
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
  // Aceptados que todavía no se entregan: el cliente los sigue en su enlace.
  const ongoing = orders.filter((o) => o.status === "DONE" && o.stage !== "DELIVERED")
  const past = orders.filter((o) => o.status !== "NEW" && !ongoing.includes(o))
  const discarded = past.filter((o) => o.status === "CANCELLED")

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
                <Badge variant="outline" className={cn("shrink-0", o.table && "border-primary/40 bg-primary/10 text-primary")}>
                  {o.table ? (
                    <>🍽️ {o.table}</>
                  ) : o.delivery ? (
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
              {o.promoDiscount || o.couponDiscount ? (
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {o.promoDiscount ? `🏷️ Promociones −${money(o.promoDiscount)}` : ""}
                  {o.promoDiscount && o.couponDiscount ? " · " : ""}
                  {o.couponDiscount ? `🎟️ Cupón ${o.couponCode} −${money(o.couponDiscount)}` : ""}
                </p>
              ) : null}
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="tabular text-lg font-semibold">{money(o.total)}</span>
              </div>
              <StageControl order={o} businessName={businessName} />
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
                    <a
                      href={whatsappLink(o.customerPhone, orderReplyText(o.customerName, o.code, businessName))}
                      // Con el enlace de seguimiento (se arma al tocar, con la dirección de esta página).
                      onClick={(e) => (e.currentTarget.href = whatsappLink(o.customerPhone, orderReplyText(o.customerName, o.code, businessName, trackUrl(o))))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
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
                {canDelete ? (
                  <ConfirmDelete
                    label="Eliminar pedido"
                    title={`¿Eliminar el pedido de ${o.customerName}?`}
                    description="Se borra para siempre, sin registrar venta. Úsalo para pedidos de prueba o de alguien que solo estaba mirando."
                    onConfirm={() => deleteWebOrders([o.id])}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {ongoing.length ? (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">En curso</p>
            <p className="text-xs text-muted-foreground">Ya registrados. Avanza cada pedido y tu cliente lo ve en su enlace de seguimiento.</p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {ongoing.map((o) => (
              <li key={o.id} className="space-y-3 rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{o.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      N.º {o.code} · {when(o.createdAt)} · {o.asComanda ? "Comanda" : "Vendido"}
                    </p>
                  </div>
                  <span className="tabular shrink-0 font-semibold">{money(o.total)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</p>
                <StageControl order={o} businessName={businessName} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {past.length ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Atendidos en los últimos 7 días</p>
            {canDelete && discarded.length > 1 ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  if (window.confirm(`¿Eliminar los ${discarded.length} pedidos descartados? Se borran para siempre.`)) void run("descartados", () => deleteWebOrders(discarded.map((o) => o.id)))
                }}
                disabled={busy === "descartados"}
              >
                {busy === "descartados" ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Eliminar descartados
              </Button>
            ) : null}
          </div>
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
                  {canDelete && o.status === "CANCELLED" ? (
                    <ConfirmDelete
                      label="Eliminar pedido"
                      title={`¿Eliminar el pedido de ${o.customerName}?`}
                      description="Se borra para siempre de la lista."
                      onConfirm={() => deleteWebOrders([o.id])}
                    />
                  ) : null}
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

/** En qué va el pedido (lo que ve el cliente), avisarle por WhatsApp y copiar su enlace de seguimiento. */
function StageControl({ order, businessName }: { order: WebOrderRow; businessName: string }) {
  const router = useRouter()
  const [stage, setStage] = React.useState(order.stage)
  const [pending, startTransition] = React.useTransition()
  // Si otra persona lo cambió (al recargar), se muestra lo nuevo.
  const [seen, setSeen] = React.useState(order.stage)
  if (seen !== order.stage) {
    setSeen(order.stage)
    setStage(order.stage)
  }

  function choose(next: OrderStage) {
    if (next === stage) return
    const before = stage
    setStage(next)
    startTransition(async () => {
      const r = await setWebOrderStage(order.id, next)
      if (!r.ok) {
        setStage(before)
        return void toast.error(r.message)
      }
      const label = orderStageLabel(next, order)
      toast.success(order.customerPhone ? `${label}. Avísale a ${order.customerName.split(" ")[0]} por WhatsApp.` : label)
      router.refresh()
    })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(trackUrl(order))
      toast.success("Enlace de seguimiento copiado")
    } catch {
      toast.error("No se pudo copiar el enlace.")
    }
  }

  function notify() {
    const text = orderStageText({
      customerName: order.customerName,
      code: order.code,
      businessName,
      stage,
      delivery: order.delivery,
      table: order.table,
      trackUrl: trackUrl(order),
    })
    window.open(whatsappLink(order.customerPhone, text), "_blank", "noopener,noreferrer")
  }

  return (
    <div className="space-y-2 rounded-xl bg-muted/50 p-2.5">
      <p className="text-xs font-medium text-muted-foreground">Lo que ve el cliente en su enlace</p>
      <div role="radiogroup" aria-label="Etapa del pedido" className="grid grid-cols-4 gap-1">
        {ORDER_STAGES.map((s, i) => {
          const reached = ORDER_STAGES.indexOf(stage) >= i
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={stage === s}
              onClick={() => choose(s)}
              disabled={pending}
              className={cn(
                "rounded-lg border px-1 py-1.5 text-[11px] leading-tight font-medium transition-colors",
                stage === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : reached
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {orderStageLabel(s, order)}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {order.customerPhone ? (
          <Button size="sm" variant="outline" className="h-8" onClick={notify}>
            <MessageCircle />
            Avisar por WhatsApp
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" className="h-8" onClick={() => void copy()}>
          <Link2 />
          Copiar enlace
        </Button>
      </div>
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
