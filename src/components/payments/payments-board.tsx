"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Copy, ExternalLink, Link2, Loader2, Plus, Send, Unplug, X } from "lucide-react"
import { toast } from "sonner"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/currency"
import { mpMethodLabel, ONLINE_FEE_RATE, ONLINE_STATUS_LABEL, paymentLinkPath, paymentLinkWhatsappText, type OnlineStatus } from "@/lib/online-payments"
import { cn } from "@/lib/utils"
import { whatsappLink } from "@/lib/whatsapp"
import { cancelPaymentLink, createPaymentLink, disconnectMercadoPago, setStorePayments } from "@/server/actions/online-payments"

export type PaymentRow = { id: string; description: string; amount: number; fee: number; status: OnlineStatus; method: string | null; createdAt: string; paidAt: string | null }
export type LinkRow = { id: string; token: string; title: string; amount: number; customerName: string | null; customerPhone: string | null; status: "ACTIVE" | "PAID" | "CANCELLED"; createdAt: string }

export function PaymentsBoard({
  connected,
  storeMode,
  canManage,
  payments,
  links,
  currency,
  timezone,
  businessName,
  notice,
}: {
  connected: boolean
  /** Qué se paga online en la tienda (lo fija el dueño). */
  storeMode: "OFF" | "ALL" | "DELIVERY"
  canManage: boolean
  payments: PaymentRow[]
  links: LinkRow[]
  currency: string
  timezone: string
  businessName: string
  /** Resultado de la conexión con Mercado Pago (al volver). */
  notice: "conectado" | "error" | "permiso" | null
}) {
  const router = useRouter()
  const money = (n: number) => formatMoney(n, currency)
  const day = (iso: string) => new Intl.DateTimeFormat("es-CL", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
  const [busy, setBusy] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const url = (l: LinkRow) => `${window.location.origin}${paymentLinkPath(l.token)}`
  const approved = payments.filter((p) => p.status === "APPROVED")
  const received = approved.reduce((s, p) => s + p.amount, 0)

  React.useEffect(() => {
    if (notice === "conectado") toast.success("¡Listo! Tu cuenta de Mercado Pago quedó conectada")
    else if (notice === "error") toast.error("No se pudo conectar con Mercado Pago. Vuelve a intentar.")
    else if (notice === "permiso") toast.error("Solo el dueño o un administrador puede conectar Mercado Pago.")
  }, [notice])

  async function run(key: string, action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(key)
    const r = await action()
    setBusy(null)
    if (!r.ok) toast.error(r.message)
    else toast.success(r.message)
    router.refresh()
  }

  async function copy(l: LinkRow) {
    try {
      await navigator.clipboard.writeText(url(l))
      toast.success("Enlace copiado")
    } catch {
      toast.error("No se pudo copiar el enlace.")
    }
  }

  return (
    <div className="space-y-6">
      {/* Conexión */}
      <section className="space-y-3 rounded-2xl border bg-card p-5">
        {connected ? (
          <>
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="size-5 text-primary" />
              Tu cuenta de Mercado Pago está conectada
            </p>
            <p className="text-sm text-muted-foreground">
              Tus clientes pagan con tarjeta o con su saldo de Mercado Pago, y el dinero llega directo a tu cuenta. Mercado Pago descuenta su comisión y OrdenSimple
              un {Math.round(ONLINE_FEE_RATE * 100)} % por cada pago.
            </p>
            <div className="space-y-2 rounded-xl border p-3">
              <p className="text-sm font-medium">¿Cómo te pagan los pedidos de tu tienda?</p>
              <div role="radiogroup" aria-label="Cómo te pagan los pedidos de tu tienda" className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { value: "OFF", label: "Al retirar o recibir", hint: "Como siempre: lo acuerdas por WhatsApp." },
                    { value: "ALL", label: "Todo online, al pedir", hint: "Ningún pedido llega sin pagar." },
                    { value: "DELIVERY", label: "Despachos online", hint: "Los despachos se pagan al pedir; los retiros, al retirar." },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={storeMode === o.value}
                    onClick={() => o.value !== storeMode && void run("tienda", () => setStorePayments(o.value))}
                    disabled={!canManage || busy !== null}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60",
                      storeMode === o.value ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="block font-medium">{o.label}</span>
                    <span className="block text-xs opacity-80">{o.hint}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Lo decides tú: tu cliente no elige. Un pedido que se debe pagar online te llega cuando ya está pagado.</p>
            </div>
            <p className="text-xs text-muted-foreground">También pueden pagar tus cotizaciones desde su enlace, y puedes crear enlaces de pago abajo.</p>
            {canManage ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  if (window.confirm("¿Desconectar tu cuenta de Mercado Pago? Tus clientes ya no podrán pagar online.")) void run("desconectar", () => disconnectMercadoPago())
                }}
                disabled={busy !== null}
              >
                <Unplug />
                Desconectar
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <p className="font-semibold">Recibe pagos online con Mercado Pago</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Tus clientes pagan con tarjeta de crédito, débito o su saldo de Mercado Pago.</li>
              <li>• En tu tienda online, en tus cotizaciones o con un enlace de pago que mandas por WhatsApp.</li>
              <li>• El dinero llega directo a tu cuenta de Mercado Pago y el pago queda registrado aquí.</li>
              <li>
                • Mercado Pago cobra su comisión de siempre y OrdenSimple un {Math.round(ONLINE_FEE_RATE * 100)} % por pago. Sin costo fijo: solo pagas cuando te
                pagan.
              </li>
            </ul>
            {canManage ? (
              <Button asChild size="lg" className="h-11">
                <a href="/api/mercadopago/conectar">Conectar mi cuenta de Mercado Pago</a>
              </Button>
            ) : (
              <p className="text-sm">Pídele al dueño o a un administrador que conecte la cuenta de Mercado Pago.</p>
            )}
            <p className="text-xs text-muted-foreground">Te llevamos a Mercado Pago para que lo autorices. Nunca vemos tu clave.</p>
          </>
        )}
      </section>

      {connected ? (
        <>
          {/* Enlaces de pago */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Enlaces de pago</p>
                <p className="text-sm text-muted-foreground">Cobra un monto y envíalo por WhatsApp. Al pagarse, queda como venta.</p>
              </div>
              <Button onClick={() => setCreating(true)}>
                <Plus />
                Nuevo enlace
              </Button>
            </div>
            {links.length ? (
              <ul className="divide-y rounded-2xl border bg-card">
                {links.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{l.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {l.customerName ? `${l.customerName} · ` : ""}
                        {day(l.createdAt)}
                      </span>
                    </span>
                    <span className="tabular font-semibold">{money(l.amount)}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        l.status === "PAID" ? "bg-success/15 text-success" : l.status === "ACTIVE" ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {l.status === "PAID" ? "Pagado" : l.status === "ACTIVE" ? "Por pagar" : "Anulado"}
                    </span>
                    {l.status === "ACTIVE" ? (
                      <span className="flex gap-1">
                        {l.customerPhone ? (
                          <Button
                            size="icon-sm"
                            variant="outline"
                            aria-label="Enviar por WhatsApp"
                            onClick={() =>
                              window.open(whatsappLink(l.customerPhone, paymentLinkWhatsappText({ businessName, customerName: l.customerName, title: l.title, amount: money(l.amount), url: url(l) })), "_blank", "noopener,noreferrer")
                            }
                          >
                            <Send />
                          </Button>
                        ) : null}
                        <Button size="icon-sm" variant="outline" aria-label="Copiar enlace" onClick={() => void copy(l)}>
                          <Copy />
                        </Button>
                        <Button size="icon-sm" variant="ghost" asChild aria-label="Ver enlace">
                          <a href={paymentLinkPath(l.token)} target="_blank" rel="noopener noreferrer">
                            <ExternalLink />
                          </a>
                        </Button>
                        <Button size="icon-sm" variant="ghost" className="text-muted-foreground" aria-label="Anular enlace" onClick={() => void run(l.id, () => cancelPaymentLink(l.id))} disabled={busy !== null}>
                          {busy === l.id ? <Loader2 className="animate-spin" /> : <X />}
                        </Button>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Todavía no creas enlaces de pago.</p>
            )}
          </section>

          {/* Pagos recibidos */}
          <section className="space-y-3">
            <div>
              <p className="font-semibold">Pagos online</p>
              <p className="text-sm text-muted-foreground">
                {approved.length ? `Recibiste ${money(received)} en ${approved.length} ${approved.length === 1 ? "pago" : "pagos"} (los últimos 100).` : "Aquí verás cada pago que te hagan online."}
              </p>
            </div>
            {payments.length ? (
              <ul className="divide-y rounded-2xl border bg-card">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {day(p.paidAt ?? p.createdAt)}
                        {p.status === "APPROVED" ? ` · ${mpMethodLabel(p.method)} · comisión OrdenSimple ${money(p.fee)}` : ""}
                      </span>
                    </span>
                    <span className="tabular font-semibold">{money(p.amount)}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", p.status === "APPROVED" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                      {ONLINE_STATUS_LABEL[p.status]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      ) : null}

      {creating ? (
        <LinkDialog
          currency={currency}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function LinkDialog({ currency, onClose, onCreated }: { currency: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = React.useState("")
  const [amount, setAmount] = React.useState(0)
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [pending, startTransition] = React.useTransition()
  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await createPaymentLink({ title, amount, customerName: name || undefined, customerPhone: phone || undefined })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message)
      onCreated()
    })
  }
  return (
    <AppModal open onOpenChange={(o) => !o && onClose()} title="Nuevo enlace de pago" description="Lo envías por WhatsApp y tu cliente paga con tarjeta o Mercado Pago." noAutoFocus>
      <form onSubmit={submit} className="grid gap-4">
        <Field label="¿Qué estás cobrando?" htmlFor="pl-title">
          <Input id="pl-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="h-10" placeholder="Ej.: Torta de cumpleaños (abono)" />
        </Field>
        <Field label="Monto" htmlFor="pl-amount">
          <MoneyInput id="pl-amount" value={amount} onValueChange={setAmount} currency={currency} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente" htmlFor="pl-name" optional>
            <Input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-10" />
          </Field>
          <Field label="WhatsApp" htmlFor="pl-phone" optional>
            <Input id="pl-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} inputMode="tel" className="h-10" />
          </Field>
        </div>
        <Button type="submit" disabled={pending || amount <= 0 || title.trim().length < 2}>
          {pending ? <Loader2 className="animate-spin" /> : <Link2 />}
          Crear enlace
        </Button>
      </form>
    </AppModal>
  )
}
