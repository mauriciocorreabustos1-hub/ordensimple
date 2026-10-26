import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import { Check, PackageCheck, XCircle } from "lucide-react"
import { AutoRefresh } from "@/components/app/auto-refresh"
import { BusinessLogo } from "@/components/app/business-logo"
import { WhatsAppIcon } from "@/components/landing/social-links"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { formatMoney } from "@/lib/currency"
import { formatDateTime } from "@/lib/dates"
import { ORDER_STAGES, orderStageLabel, storePath, type OrderStage } from "@/lib/store"
import { cn } from "@/lib/utils"
import { whatsappLink } from "@/lib/whatsapp"
import { PayButton, PayResult } from "@/components/payments/pay-button"
import { mpMethodLabel } from "@/lib/online-payments"
import { onlinePayInfo } from "@/server/mp-marketplace"

// Seguimiento de un pedido de la tienda online: el cliente ve en qué va sin tener que preguntar.
// El enlace es aleatorio (solo lo tiene quien hizo el pedido) y la página no aparece en buscadores.

const TOKEN_RE = /^[\w-]{16,64}$/

const getOrder = cache(async (token: string) => {
  if (!TOKEN_RE.test(token)) return null
  return db.webOrder.findUnique({
    where: { trackToken: token },
    select: {
      id: true,
      customerName: true,
      delivery: true,
      table: true,
      items: true,
      total: true,
      status: true,
      stage: true,
      stageTimes: true,
      createdAt: true,
      business: {
        select: { id: true, name: true, currency: true, timezone: true, logoUpdatedAt: true, storeWhatsapp: true, storeSlug: true, storeEnabled: true },
      },
    },
  })
})

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false, follow: false } }

export default async function OrderTrackPage({ params, searchParams }: PageProps<"/pedido/[token]">) {
  const { token } = await params
  const { pago } = await searchParams
  const order = await getOrder(token)
  if (!order) notFound()
  const pay = await onlinePayInfo(order.business.id, { webOrderId: order.id })
  const b = order.business
  const code = order.id.slice(-5).toUpperCase()
  const money = (n: number) => formatMoney(n, b.currency)
  const items = order.items as { name: string; quantity: number; unitPrice: number }[]
  const times = (order.stageTimes as Partial<Record<OrderStage, string>> | null) ?? {}
  const cancelled = order.status === "CANCELLED"
  const current = ORDER_STAGES.indexOf(order.stage)
  const when = (iso: string | Date) => formatDateTime(new Date(iso), b.timezone)
  const first = order.customerName.split(" ")[0] || order.customerName

  return (
    <div className="min-h-dvh bg-muted/30">
      <AutoRefresh seconds={30} />
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-4">
          <BusinessLogo businessId={b.id} name={b.name} logoUpdatedAt={b.logoUpdatedAt} className="size-12 rounded-xl border" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{b.name}</h1>
            <p className="text-sm text-muted-foreground">Seguimiento de tu pedido</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
        <PayResult result={typeof pago === "string" ? pago : undefined} />
        <section className="space-y-5 rounded-2xl border bg-background p-5">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Hola, {first}. Pedido n.º <span className="font-semibold text-foreground">{code}</span> · {when(order.createdAt)}
            </p>
            {cancelled ? (
              <p className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-destructive">
                <XCircle className="size-7" />
                Pedido cancelado
              </p>
            ) : (
              <p className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <PackageCheck className="size-7 text-primary" />
                {orderStageLabel(order.stage, order)}
              </p>
            )}
            {cancelled ? (
              <p className="text-sm text-muted-foreground">Si tienes dudas, escríbele a {b.name}.</p>
            ) : order.stage !== "DELIVERED" ? (
              <p className="text-sm text-muted-foreground">Esta página se actualiza sola: déjala abierta o vuelve cuando quieras.</p>
            ) : null}
          </div>

          {cancelled ? null : (
            <ol className="space-y-0">
              {ORDER_STAGES.map((stage, i) => {
                const reached = i <= current
                const at = stage === "RECEIVED" ? order.createdAt : times[stage]
                return (
                  <li key={stage} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < ORDER_STAGES.length - 1 ? (
                      <span aria-hidden className={cn("absolute top-7 left-[13px] h-[calc(100%-1.75rem)] w-0.5", i < current ? "bg-primary" : "bg-border")} />
                    ) : null}
                    <span
                      className={cn(
                        "relative flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                        reached ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                        i === current && "ring-4 ring-primary/20",
                      )}
                    >
                      {reached ? <Check className="size-4" /> : null}
                    </span>
                    <div className="pt-0.5">
                      <p className={cn("text-sm font-medium", !reached && "text-muted-foreground")}>{orderStageLabel(stage, order)}</p>
                      {reached && at ? <p className="text-xs text-muted-foreground">{when(at)}</p> : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <section className="space-y-2 rounded-2xl border bg-background p-5 text-sm">
          <p className="font-medium">{order.table ? `🍽️ ${order.table}` : order.delivery ? "🛵 Despacho a domicilio" : "🏪 Retiro en el local"}</p>
          <ul className="space-y-1">
            {items.map((i, n) => (
              <li key={n} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {i.quantity} × {i.name}
                </span>
                <span className="tabular shrink-0 text-muted-foreground">{money(i.quantity * i.unitPrice)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular">{money(order.total)}</span>
          </div>
          {pay.paid ? <p className="font-medium text-success">✅ Pagado con {mpMethodLabel(pay.paid.method)}</p> : null}
        </section>

        {!pay.paid && pay.storeEnabled && !cancelled && order.stage !== "DELIVERED" ? <PayButton kind="order" token={token} label="Pagar ahora con tarjeta o Mercado Pago" /> : null}

        <div className="grid gap-2">
          {b.storeWhatsapp ? (
            <Button asChild size="lg" className="h-12 bg-[#25D366] text-white hover:bg-[#1fb757]">
              <a href={whatsappLink(b.storeWhatsapp, `¡Hola, ${b.name}! Te escribo por mi pedido n.º ${code}.`)} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="size-5" />
                Escribir a {b.name}
              </a>
            </Button>
          ) : null}
          {b.storeEnabled && b.storeSlug ? (
            <Button asChild variant="outline">
              <Link href={storePath(b.storeSlug)}>Volver a la tienda</Link>
            </Button>
          ) : null}
        </div>
      </main>
      <footer className="pb-10 text-center text-xs text-muted-foreground">
        Hecho con{" "}
        <Link href="/?utm_source=seguimiento" className="font-medium text-primary hover:underline">
          OrdenSimple
        </Link>
      </footer>
    </div>
  )
}
