import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import { BusinessLogo } from "@/components/app/business-logo"
import { WhatsAppIcon } from "@/components/landing/social-links"
import { QuoteActions } from "@/components/quotes/quote-actions"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { formatMoney } from "@/lib/currency"
import { formatDate } from "@/lib/dates"
import { canUseFeature, effectivePlan } from "@/lib/plans"
import { grossBreakdown, QUOTE_STATE_LABEL, quoteNumber, quoteState, type QuoteItem } from "@/lib/quotes"
import { cn } from "@/lib/utils"
import { vatInfo } from "@/lib/vat"
import { whatsappLink } from "@/lib/whatsapp"
import { getSession } from "@/server/session"
import { PayButton, PayResult } from "@/components/payments/pay-button"
import { mpMethodLabel } from "@/lib/online-payments"
import { onlinePayInfo } from "@/server/mp-marketplace"

// Cotización que el negocio le envía al cliente: la revisa, la guarda en PDF y la acepta o rechaza.
// El enlace es aleatorio (solo lo tiene a quien se le envió) y la página no aparece en buscadores.

const TOKEN_RE = /^[\w-]{16,64}$/

const getQuote = cache(async (token: string) => {
  if (!TOKEN_RE.test(token)) return null
  return db.quote.findUnique({
    where: { token },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          country: true,
          currency: true,
          timezone: true,
          plan: true,
          planExpiresAt: true,
          logoUpdatedAt: true,
          storeWhatsapp: true,
          settings: { select: { taxId: true, address: true, contactPhone: true, contactEmail: true, quoteTerms: true, chargesVat: true } },
        },
      },
    },
  })
})

export async function generateMetadata({ params }: PageProps<"/cotizacion/[token]">): Promise<Metadata> {
  const quote = await getQuote((await params).token)
  return {
    title: { absolute: quote ? `Cotización ${quoteNumber(quote.number)} · ${quote.business.name}` : "Cotización" },
    robots: { index: false, follow: false },
  }
}

export default async function QuotePublicPage({ params, searchParams }: PageProps<"/cotizacion/[token]">) {
  const { token } = await params
  const { pago } = await searchParams
  const quote = await getQuote(token)
  if (!quote) notFound()
  const b = quote.business
  const s = b.settings
  const money = (n: number) => formatMoney(n, b.currency)
  const date = (d: Date) => formatDate(d, b.timezone, { day: "numeric", month: "long", year: "numeric" })
  const items = quote.items as QuoteItem[]
  const state = quoteState(quote.status, quote.validUntil)
  const active = canUseFeature(effectivePlan(b), "quotes")
  const vat = s?.chargesVat ? vatInfo(b.country) : null
  const tax = vat ? grossBreakdown(quote.total, vat.rate) : null
  const contactPhone = s?.contactPhone || b.storeWhatsapp
  const pay = await onlinePayInfo(b.id, { quoteId: quote.id })

  // La primera vez que la abre el cliente (no alguien del negocio revisándola).
  if (!quote.viewedAt) {
    const session = await getSession()
    const insider = session ? await db.businessMember.findFirst({ where: { businessId: b.id, userId: session.user.id }, select: { id: true } }) : null
    if (!insider) await db.quote.updateMany({ where: { id: quote.id, viewedAt: null }, data: { viewedAt: new Date() } })
  }

  const banner: Record<typeof state, { text: string; className: string } | null> = {
    PENDING: null,
    ACCEPTED: { text: "Aceptaste esta cotización. El negocio ya recibió el aviso y te contactará.", className: "border-success/30 bg-success/10 text-success" },
    SOLD: { text: "Esta cotización ya se concretó. ¡Gracias por tu compra!", className: "border-primary/30 bg-primary/10 text-primary" },
    REJECTED: { text: "Esta cotización fue rechazada. Si cambiaste de opinión, escríbele al negocio.", className: "border-border bg-muted text-muted-foreground" },
    EXPIRED: { text: `Esta cotización venció el ${date(quote.validUntil)}. Escríbele al negocio para actualizarla.`, className: "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" },
  }

  return (
    <div className="min-h-dvh bg-muted/40 print:bg-white">
      <style>{`
@media print {
  @page { size: A4; margin: 14mm }
  body * { visibility: hidden !important }
  #quote-doc, #quote-doc * { visibility: visible !important }
  #quote-doc { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important }
  .no-print { display: none !important }
}`}</style>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:py-10">
        <PayResult result={typeof pago === "string" ? pago : undefined} />
        {pay.paid ? <p className="no-print rounded-2xl border border-success/30 bg-success/10 p-4 text-sm font-medium text-success">✅ Cotización pagada con {mpMethodLabel(pay.paid.method)}. ¡Gracias!</p> : null}
        {banner[state] && !pay.paid ? <p className={cn("no-print rounded-2xl border p-4 text-sm font-medium", banner[state].className)}>{banner[state].text}</p> : null}

        <article id="quote-doc" className="space-y-6 rounded-2xl border bg-white p-5 text-[#111] shadow-sm sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-5">
            <div className="flex min-w-0 items-start gap-3">
              <BusinessLogo businessId={b.id} name={b.name} logoUpdatedAt={b.logoUpdatedAt} className="size-14 rounded-xl border" />
              <div className="min-w-0 space-y-0.5 text-sm">
                <p className="text-lg font-semibold tracking-tight">{b.name}</p>
                {s?.taxId ? <p className="text-black/60">RUT {s.taxId}</p> : null}
                {s?.address ? <p className="text-black/60">{s.address}</p> : null}
                {contactPhone || s?.contactEmail ? <p className="text-black/60">{[contactPhone, s?.contactEmail].filter(Boolean).join(" · ")}</p> : null}
              </div>
            </div>
            <div className="text-sm sm:text-right">
              <p className="text-xs font-semibold tracking-[0.15em] text-black/50 uppercase">Cotización</p>
              <h1 className="text-2xl font-semibold tabular">N.º {quoteNumber(quote.number)}</h1>
              <p className="text-black/60">Fecha: {date(quote.createdAt)}</p>
              <p className="text-black/60">Válida hasta: {date(quote.validUntil)}</p>
              <p className="no-print mt-1 inline-block rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium">{QUOTE_STATE_LABEL[state]}</p>
            </div>
          </header>

          <section className="text-sm">
            <p className="text-xs font-semibold tracking-[0.15em] text-black/50 uppercase">Para</p>
            <p className="font-medium">{quote.customerName}</p>
            {quote.customerPhone || quote.customerEmail ? <p className="text-black/60">{[quote.customerPhone, quote.customerEmail].filter(Boolean).join(" · ")}</p> : null}
          </section>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/15 text-left text-xs text-black/50 uppercase">
                <th className="py-2 pr-2 font-semibold">Descripción</th>
                <th className="w-14 px-2 py-2 text-right font-semibold">Cant.</th>
                <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell print:table-cell">Precio unit.</th>
                <th className="py-2 pl-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, n) => (
                <tr key={n} className="border-b border-black/5 align-top">
                  <td className="py-2.5 pr-2">
                    {i.description}
                    <span className="block text-xs text-black/50 sm:hidden print:hidden">{money(i.unitPrice)} c/u</span>
                  </td>
                  <td className="tabular px-2 py-2.5 text-right">{i.quantity}</td>
                  <td className="tabular hidden px-2 py-2.5 text-right sm:table-cell print:table-cell">{money(i.unitPrice)}</td>
                  <td className="tabular py-2.5 pl-2 text-right">{money(i.quantity * i.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            {quote.discount ? (
              <>
                <div className="flex justify-between text-black/60">
                  <span>Subtotal</span>
                  <span className="tabular">{money(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-black/60">
                  <span>Descuento</span>
                  <span className="tabular">−{money(quote.discount)}</span>
                </div>
              </>
            ) : null}
            {tax && vat ? (
              <>
                <div className="flex justify-between text-black/60">
                  <span>Neto</span>
                  <span className="tabular">{money(tax.net)}</span>
                </div>
                <div className="flex justify-between text-black/60">
                  <span>
                    {vat.label} ({Math.round(vat.rate * 100)} %)
                  </span>
                  <span className="tabular">{money(tax.tax)}</span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between border-t border-black/15 pt-2 text-lg font-semibold">
              <span>Total</span>
              <span className="tabular">{money(quote.total)}</span>
            </div>
            {tax && vat ? <p className="text-right text-xs text-black/50">Valores con {vat.label} incluido</p> : null}
          </div>

          {quote.note || s?.quoteTerms ? (
            <section className="space-y-3 border-t border-black/10 pt-5 text-sm">
              {quote.note ? (
                <div>
                  <p className="text-xs font-semibold tracking-[0.15em] text-black/50 uppercase">Nota</p>
                  <p className="whitespace-pre-line">{quote.note}</p>
                </div>
              ) : null}
              {s?.quoteTerms ? (
                <div>
                  <p className="text-xs font-semibold tracking-[0.15em] text-black/50 uppercase">Condiciones</p>
                  <p className="whitespace-pre-line text-black/70">{s.quoteTerms}</p>
                </div>
              ) : null}
            </section>
          ) : null}
        </article>

        {active && pay.connected && !pay.paid && (state === "PENDING" || state === "ACCEPTED") ? (
          <div className="no-print">
            <PayButton kind="quote" token={token} label={state === "PENDING" ? "Aceptar y pagar con tarjeta o Mercado Pago" : "Pagar con tarjeta o Mercado Pago"} />
          </div>
        ) : null}
        <QuoteActions token={token} canRespond={active && state === "PENDING"} fileName={`Cotización ${quoteNumber(quote.number)} ${b.name}`} />
        {contactPhone ? (
          <Button asChild variant="outline" className="no-print w-full">
            <a href={whatsappLink(contactPhone, `¡Hola, ${b.name}! Te escribo por la cotización n.º ${quoteNumber(quote.number)}.`)} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="size-4" />
              Escribir a {b.name}
            </a>
          </Button>
        ) : null}
        <p className="no-print pt-4 text-center text-xs text-muted-foreground">
          Cotización hecha con{" "}
          <Link href="/?utm_source=cotizacion" className="font-medium text-primary hover:underline">
            OrdenSimple
          </Link>
        </p>
      </main>
    </div>
  )
}
