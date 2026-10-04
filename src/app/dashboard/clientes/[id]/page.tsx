import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, HandCoins, Mail, NotebookPen, Phone, ReceiptText, ShoppingBag, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDelete } from "@/components/app/confirm-delete"
import { ProGate } from "@/components/app/pro-gate"
import { StatCard } from "@/components/app/stat-card"
import { CustomerDialog } from "@/components/contacts/customer-dialog"
import { PAYMENT_LABEL } from "@/lib/constants"
import { formatMoney } from "@/lib/currency"
import { formatDate, formatDateTime } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { deleteCustomer } from "@/server/actions/contacts"
import { getCustomerDetail } from "@/server/queries/contacts"
import { getCustomerBalance, getCustomerFiadoHistory } from "@/server/queries/fiado"
import { PaymentDialog } from "@/components/contacts/payment-dialog"
import { deleteCustomerPayment } from "@/server/actions/fiado"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Cliente" }

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "")
  return `https://wa.me/${digits.length === 9 ? `56${digits}` : digits}`
}

export default async function CustomerDetailPage({ params }: PageProps<"/dashboard/clientes/[id]">) {
  const ctx = await requireBusiness()
  if (!canUseFeature(ctx.business.plan, "customers")) {
    return <ProGate title="Clientes" description="Conoce a quienes te compran y cuánto te compran." />
  }
  const { id } = await params
  const [detail, balance, fiadoHistory] = await Promise.all([
    getCustomerDetail(ctx.businessId, id),
    getCustomerBalance(ctx.businessId, id),
    getCustomerFiadoHistory(ctx.businessId, id),
  ])
  if (!detail) notFound()
  const canRegisterPayment = can(ctx.role, "sales:create")
  const canDeletePayment = can(ctx.role, "sales:delete")
  const { customer: c } = detail
  const money = (n: number) => formatMoney(n, ctx.currency)
  const canManage = can(ctx.role, "customers:manage")

  return (
    <div className="space-y-6">
      <Link href="/dashboard/clientes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Clientes
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{c.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {c.phone ? (
              <a href={waLink(c.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary">
                <Phone className="size-4" />
                {c.phone} · WhatsApp
              </a>
            ) : null}
            {c.email ? (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                <Mail className="size-4" />
                {c.email}
              </a>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              Cliente desde {formatDate(c.createdAt, ctx.timezone)}
            </span>
          </div>
          {c.notes ? <p className="max-w-xl rounded-lg bg-muted/60 px-3 py-2 text-sm">{c.notes}</p> : null}
        </div>
        {canManage ? (
          <div className="flex items-center gap-2">
            <CustomerDialog id={c.id} initial={{ name: c.name, phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "" }} />
            <ConfirmDelete
              title="¿Eliminar este cliente?"
              description="Sus compras se mantienen en tu historial de ventas, pero sin el nombre del cliente."
              onConfirm={deleteCustomer.bind(null, c.id)}
              redirectTo="/dashboard/clientes"
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard compactOnMobile label="Total comprado" value={money(detail.total)} icon={Wallet} tone="sales" />
        <StatCard compactOnMobile label="Compras" value={String(detail.purchases)} icon={ShoppingBag}
          hint={detail.last ? `Última: ${formatDate(detail.last, ctx.timezone)}` : "Aún no compra."} />
        <StatCard compactOnMobile label="Compra promedio" value={money(detail.average)} icon={ReceiptText} tone="profit"
          hint="Lo que gasta en promedio cada vez que te compra." />
      </div>

      {balance > 0 || fiadoHistory.length ? (
        <Card className={balance > 0 ? "border-warning/40" : undefined}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <NotebookPen className="size-4 text-warning" />
                Fiado
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {balance > 0 ? (
                  <>
                    Te debe <span className="tabular text-lg font-semibold text-foreground">{money(balance)}</span>
                  </>
                ) : (
                  "Está al día: no te debe nada."
                )}
              </p>
            </div>
            {balance > 0 && canRegisterPayment ? (
              <PaymentDialog
                customerId={c.id}
                customerName={c.name}
                balance={balance}
                currency={ctx.currency}
                timezone={ctx.timezone}
              />
            ) : null}
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {fiadoHistory.map((e) => (
                <li key={`${e.kind}-${e.id}`} className="flex items-center gap-3 py-2.5 text-sm">
                  {e.kind === "abono" ? (
                    <HandCoins className="size-4 shrink-0 text-success" />
                  ) : (
                    <NotebookPen className="size-4 shrink-0 text-warning" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {e.kind === "abono" ? `Abono · ${PAYMENT_LABEL[e.paymentMethod]}` : `Fiado · ${e.detail}`}
                      {e.kind === "abono" && e.detail ? ` · ${e.detail}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.date, ctx.timezone)}</p>
                  </div>
                  <span className={`tabular font-semibold ${e.kind === "abono" ? "text-success" : ""}`}>
                    {e.kind === "abono" ? "−" : "+"}
                    {money(e.amount)}
                  </span>
                  {e.kind === "abono" && canDeletePayment ? (
                    <ConfirmDelete
                      title="¿Eliminar este abono?"
                      description={`El abono de ${money(e.amount)} se eliminará y la deuda volverá a subir.`}
                      onConfirm={deleteCustomerPayment.bind(null, e.id)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Historial de compras</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.sales.length === 0 ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Todavía no hay ventas asociadas a este cliente.</p>
              <p>Al registrar una venta con detalle, escribe su nombre en “Cliente” para que aparezca aquí.</p>
              <Button variant="outline" asChild>
                <Link href="/dashboard/ventas">Ir a Ventas</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {detail.sales.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {s.items.map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.description}` : i.description)).join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(s.date, ctx.timezone)} · {PAYMENT_LABEL[s.paymentMethod]}
                    </p>
                  </div>
                  <span className="tabular font-semibold">{money(s.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
