"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Eye, FileText, Loader2, MoreHorizontal, Pencil, Plus, Send, ShoppingBag, Trash2, Undo2, X } from "lucide-react"
import { toast } from "sonner"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { AppModal } from "@/components/app/app-modal"
import { EmptyState } from "@/components/app/empty-state"
import { PaymentChips } from "@/components/app/payment-chips"
import { QuoteForm, type QuoteCustomer, type QuoteDraft, type QuoteProduct } from "@/components/quotes/quote-form"
import { QuoteInfoButton, type QuoteInfo } from "@/components/quotes/quote-info"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatMoney } from "@/lib/currency"
import { QUOTE_STATE_CLASS, QUOTE_STATE_LABEL, quoteNumber, quotePath, quoteState, quoteWhatsappText, type QuoteItem, type QuoteState, type QuoteStatusValue } from "@/lib/quotes"
import { cn } from "@/lib/utils"
import { whatsappLink } from "@/lib/whatsapp"
import { mpMethodLabel, saleMethodFromMp } from "@/lib/online-payments"
import { deleteQuote, sellQuote, setQuoteStatus } from "@/server/actions/quotes"

export type QuoteRow = {
  id: string
  number: number
  token: string
  customerId: string | null
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  items: QuoteItem[]
  discount: number
  total: number
  note: string | null
  validUntil: string
  validDays: number
  status: QuoteStatusValue
  viewedAt: string | null
  respondedAt: string | null
  createdAt: string
  /** Pagada online con Mercado Pago: cómo (credit_card, debit_card…). */
  paidOnline: string | null
}

type Filter = "all" | "open" | "ACCEPTED" | "SOLD" | "closed"
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "open", label: "Pendientes" },
  { value: "ACCEPTED", label: "Aceptadas" },
  { value: "SOLD", label: "Vendidas" },
  { value: "closed", label: "Rechazadas o vencidas" },
]
const inFilter = (state: QuoteState, f: Filter) =>
  f === "all" || (f === "open" ? state === "PENDING" : f === "closed" ? state === "REJECTED" || state === "EXPIRED" : state === f)

export function QuotesBoard({
  quotes,
  products,
  customers,
  info,
  currency,
  timezone,
  businessName,
  defaultPayment,
  productsOnly,
  canDelete,
  canEditInfo,
}: {
  quotes: QuoteRow[]
  products: QuoteProduct[]
  customers: QuoteCustomer[]
  info: QuoteInfo
  currency: string
  timezone: string
  businessName: string
  defaultPayment: PaymentMethod
  productsOnly: boolean
  canDelete: boolean
  canEditInfo: boolean
}) {
  const router = useRouter()
  const money = (n: number) => formatMoney(n, currency)
  const day = (iso: string) => new Intl.DateTimeFormat("es-CL", { timeZone: timezone, day: "numeric", month: "short" }).format(new Date(iso))
  const longDay = (iso: string) => new Intl.DateTimeFormat("es-CL", { timeZone: timezone, day: "numeric", month: "long", year: "numeric" }).format(new Date(iso))
  const [filter, setFilter] = React.useState<Filter>("all")
  const [form, setForm] = React.useState<{ editing?: QuoteDraft } | null>(null)
  const [selling, setSelling] = React.useState<QuoteRow | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const now = React.useMemo(() => new Date(), [])
  const rows = quotes.map((q) => ({ ...q, state: quoteState(q.status, q.validUntil, now) }))
  const shown = rows.filter((q) => inFilter(q.state, filter))
  const url = (q: QuoteRow) => `${window.location.origin}${quotePath(q.token)}`

  async function run(id: string, action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(id)
    const r = await action()
    setBusy(null)
    if (!r.ok) toast.error(r.message)
    else toast.success(r.message)
    router.refresh()
  }

  function send(q: QuoteRow) {
    const text = quoteWhatsappText({ businessName, customerName: q.customerName, number: q.number, total: money(q.total), validUntil: longDay(q.validUntil), url: url(q) })
    window.open(whatsappLink(q.customerPhone, text), "_blank", "noopener,noreferrer")
  }

  async function copy(q: QuoteRow) {
    try {
      await navigator.clipboard.writeText(url(q))
      toast.success("Enlace copiado: pégalo donde quieras enviarlo")
    } catch {
      toast.error("No se pudo copiar el enlace.")
    }
  }

  const missingInfo = !info.taxId && !info.address && !info.contactPhone && !info.contactEmail

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setForm({})}>
          <Plus />
          Nueva cotización
        </Button>
        {canEditInfo ? <QuoteInfoButton info={info} /> : null}
      </div>
      {missingInfo && canEditInfo ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          Agrega tu RUT, dirección y contacto en <strong>Datos del negocio</strong> para que salgan en tus cotizaciones.
        </p>
      ) : null}

      {quotes.length ? (
        <>
          <div role="radiogroup" aria-label="Filtrar cotizaciones" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const count = rows.filter((q) => inFilter(q.state, f.value)).length
              return (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    filter === f.value ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label} <span className="tabular opacity-70">{count}</span>
                </button>
              )
            })}
          </div>

          {shown.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {shown.map((q) => (
                <li key={q.id} className="space-y-3 rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{q.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        N.º {quoteNumber(q.number)} · {day(q.createdAt)}
                      </p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", QUOTE_STATE_CLASS[q.state])}>{QUOTE_STATE_LABEL[q.state]}</span>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <p>
                        {q.items.length} {q.items.length === 1 ? "línea" : "líneas"}
                        {q.state === "PENDING" ? ` · válida hasta el ${day(q.validUntil)}` : ""}
                      </p>
                      <p className="flex items-center gap-1">
                        <Eye className="size-3.5" />
                        {q.viewedAt ? `El cliente la abrió el ${day(q.viewedAt)}` : "El cliente aún no la abre"}
                      </p>
                      {q.paidOnline ? <p className="font-medium text-success">💳 Pagada online con {mpMethodLabel(q.paidOnline)}</p> : null}
                    </div>
                    <span className="tabular text-lg font-semibold">{money(q.total)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {q.state !== "SOLD" && q.state !== "REJECTED" ? (
                      <Button size="sm" className="flex-1" onClick={() => setSelling(q)} disabled={busy === q.id}>
                        <ShoppingBag />
                        Vender
                      </Button>
                    ) : null}
                    {q.customerPhone ? (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => send(q)}>
                        <Send />
                        Enviar por WhatsApp
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => void copy(q)}>
                        <Copy />
                        Copiar enlace
                      </Button>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <a href={quotePath(q.token)} target="_blank" rel="noopener noreferrer">
                        <FileText />
                        Ver
                      </a>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label="Más opciones" disabled={busy === q.id}>
                          {busy === q.id ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {q.state !== "SOLD" ? (
                          <DropdownMenuItem
                            onSelect={() =>
                              setForm({
                                editing: {
                                  id: q.id,
                                  customerId: q.customerId,
                                  customerName: q.customerName,
                                  customerPhone: q.customerPhone,
                                  customerEmail: q.customerEmail,
                                  items: q.items,
                                  discount: q.discount,
                                  note: q.note,
                                  validDays: q.validDays,
                                },
                              })
                            }
                          >
                            <Pencil />
                            Editar
                          </DropdownMenuItem>
                        ) : null}
                        {q.customerPhone ? (
                          <DropdownMenuItem onSelect={() => void copy(q)}>
                            <Copy />
                            Copiar enlace
                          </DropdownMenuItem>
                        ) : null}
                        {q.status !== "SOLD" ? (
                          <>
                            <DropdownMenuSeparator />
                            {q.status !== "ACCEPTED" ? (
                              <DropdownMenuItem onSelect={() => void run(q.id, () => setQuoteStatus(q.id, "ACCEPTED"))}>
                                <Check />
                                Marcar aceptada
                              </DropdownMenuItem>
                            ) : null}
                            {q.status !== "REJECTED" ? (
                              <DropdownMenuItem onSelect={() => void run(q.id, () => setQuoteStatus(q.id, "REJECTED"))}>
                                <X />
                                Marcar rechazada
                              </DropdownMenuItem>
                            ) : null}
                            {q.status !== "PENDING" ? (
                              <DropdownMenuItem onSelect={() => void run(q.id, () => setQuoteStatus(q.id, "PENDING"))}>
                                <Undo2 />
                                Volver a pendiente
                              </DropdownMenuItem>
                            ) : null}
                          </>
                        ) : null}
                        {canDelete ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                if (window.confirm(`¿Eliminar la cotización n.º ${quoteNumber(q.number)}? El enlace dejará de funcionar.`)) void run(q.id, () => deleteQuote(q.id))
                              }}
                            >
                              <Trash2 />
                              Eliminar
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No hay cotizaciones en este filtro.</p>
          )}
        </>
      ) : (
        <EmptyState
          icon={FileText}
          title="Todavía no haces cotizaciones"
          description="Arma una con tus productos y precios, y envíasela al cliente por WhatsApp. Él la revisa, la descarga en PDF y la acepta desde el enlace."
        />
      )}

      {form ? (
        <AppModal
          open
          onOpenChange={(o) => !o && setForm(null)}
          title={form.editing ? "Editar cotización" : "Nueva cotización"}
          description={form.editing ? "Al guardar, vuelve a quedar pendiente para que el cliente la responda de nuevo." : "Con tus precios de hoy. Después la envías por WhatsApp."}
          noAutoFocus
        >
          <QuoteForm
            currency={currency}
            products={products}
            customers={customers}
            validDays={info.quoteValidDays}
            productsOnly={productsOnly}
            editing={form.editing}
            onDone={() => {
              setForm(null)
              router.refresh()
            }}
          />
        </AppModal>
      ) : null}

      {selling ? (
        <SellDialog
          quote={selling}
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
  quote,
  money,
  defaultPayment,
  onClose,
  onDone,
}: {
  quote: QuoteRow
  money: (n: number) => string
  defaultPayment: PaymentMethod
  onClose: () => void
  onDone: () => void
}) {
  // Si la pagó online, ya se sabe cómo.
  const [payment, setPayment] = React.useState<PaymentMethod>(quote.paidOnline ? saleMethodFromMp(quote.paidOnline) : defaultPayment)
  const [pending, startTransition] = React.useTransition()
  function confirm() {
    startTransition(async () => {
      const r = await sellQuote(quote.id, payment)
      if (!r.ok) return void toast.error(r.message)
      toast.success(`${r.message}: ${money(quote.total)}`)
      onDone()
    })
  }
  return (
    <AppModal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Vender la cotización n.º ${quoteNumber(quote.number)}`}
      description={`${quote.customerName} · ${money(quote.total)}, con los precios cotizados. Se descuenta el stock y suma a la caja de hoy.`}
      noAutoFocus
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">¿Cómo te pagó?</p>
          <PaymentChips value={payment} onChange={setPayment} />
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
