import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import { CheckCircle2 } from "lucide-react"
import { BusinessLogo } from "@/components/app/business-logo"
import { PayButton, PayResult } from "@/components/payments/pay-button"
import { db } from "@/lib/db"
import { formatMoney } from "@/lib/currency"
import { formatDate } from "@/lib/dates"
import { mpMethodLabel } from "@/lib/online-payments"
import { onlinePayInfo } from "@/server/mp-marketplace"

// Enlace de pago: el negocio cobra un monto y el cliente paga con tarjeta o Mercado Pago.
// El enlace es aleatorio y la página no aparece en buscadores.

const getLink = cache(async (token: string) => {
  if (!/^[\w-]{16,64}$/.test(token)) return null
  return db.paymentLink.findUnique({
    where: { token },
    select: { id: true, title: true, amount: true, status: true, customerName: true, paidAt: true, business: { select: { id: true, name: true, currency: true, timezone: true, logoUpdatedAt: true } } },
  })
})

export async function generateMetadata({ params }: PageProps<"/cobro/[token]">): Promise<Metadata> {
  const link = await getLink((await params).token)
  return { title: { absolute: link ? `Pagar a ${link.business.name}` : "Pago" }, robots: { index: false, follow: false } }
}

export default async function PaymentLinkPage({ params, searchParams }: PageProps<"/cobro/[token]">) {
  const { token } = await params
  const { pago } = await searchParams
  const link = await getLink(token)
  if (!link) notFound()
  const b = link.business
  const info = await onlinePayInfo(b.id, { linkId: link.id })
  const first = link.customerName?.split(" ")[0]

  return (
    <div className="min-h-dvh bg-muted/40">
      <main className="mx-auto max-w-md space-y-4 px-4 py-8">
        <PayResult result={typeof pago === "string" ? pago : undefined} />
        <section className="space-y-5 rounded-3xl border bg-background p-6 text-center shadow-sm">
          <BusinessLogo businessId={b.id} name={b.name} logoUpdatedAt={b.logoUpdatedAt} className="mx-auto size-16 rounded-2xl border" />
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{first ? `Hola, ${first}. ` : ""}Pago a</p>
            <h1 className="text-xl font-semibold tracking-tight">{b.name}</h1>
          </div>
          <div className="space-y-1 rounded-2xl bg-muted/60 p-4">
            <p className="text-sm">{link.title}</p>
            <p className="text-3xl font-semibold tabular">{formatMoney(link.amount, b.currency)}</p>
          </div>
          {link.status === "PAID" || info.paid ? (
            <p className="flex items-center justify-center gap-2 font-medium text-success">
              <CheckCircle2 className="size-5" />
              Pagado{info.paid ? ` con ${mpMethodLabel(info.paid.method)}` : ""}
              {link.paidAt ? ` el ${formatDate(link.paidAt, b.timezone, { day: "numeric", month: "long" })}` : ""}
            </p>
          ) : link.status === "CANCELLED" ? (
            <p className="text-sm text-muted-foreground">Este enlace de pago fue anulado. Si tienes dudas, escríbele a {b.name}.</p>
          ) : info.connected ? (
            <>
              <PayButton kind="link" token={token} label="Pagar con tarjeta o Mercado Pago" />
              <p className="text-xs text-muted-foreground">Pagas de forma segura en Mercado Pago. Aceptan tarjetas de crédito, débito y saldo de Mercado Pago.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Por ahora este negocio no está recibiendo pagos online. Escríbele para pagar de otra forma.</p>
          )}
        </section>
        <p className="text-center text-xs text-muted-foreground">
          Cobro hecho con{" "}
          <Link href="/?utm_source=cobro" className="font-medium text-primary hover:underline">
            OrdenSimple
          </Link>
        </p>
      </main>
    </div>
  )
}
