import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarClock, CalendarDays, Mail, Phone, ReceiptText, Truck, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDelete } from "@/components/app/confirm-delete"
import { OpenQuickAction } from "@/components/app/open-quick-action"
import { ProGate } from "@/components/app/pro-gate"
import { StatCard, STAT_GROUP } from "@/components/app/stat-card"
import { PayableActions } from "@/components/contacts/payables"
import { SupplierDialog } from "@/components/contacts/supplier-dialog"
import { formatMoney } from "@/lib/currency"
import { formatDate } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { daysUntil } from "@/lib/vat"
import { whatsappLink } from "@/lib/whatsapp"
import { deleteSupplier } from "@/server/actions/contacts"
import { getSupplierDetail } from "@/server/queries/contacts"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "Proveedor" }

/** Ficha del proveedor: sus datos, cuánto le has comprado, lo que le debes y cada compra registrada. */
export default async function SupplierDetailPage({ params }: PageProps<"/dashboard/proveedores/[id]">) {
  const ctx = await requireBusiness()
  requirePermission(ctx, "suppliers:manage")
  if (!canUseFeature(ctx.business.plan, "suppliers")) {
    return <ProGate title="Proveedores" description="Ordena a tus proveedores y descubre cuál te conviene más." />
  }
  const { id } = await params
  const detail = await getSupplierDetail(ctx.businessId, id)
  if (!detail) notFound()
  const { supplier: s } = detail
  const money = (n: number) => formatMoney(n, ctx.currency)
  const canManage = can(ctx.role, "suppliers:manage")
  const now = new Date()

  return (
    <div className="space-y-6">
      <Link href="/dashboard/proveedores" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Proveedores
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{s.name}</h1>
          {s.products ? <p className="text-muted-foreground">{s.products}</p> : null}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {s.phone ? (
              <a href={whatsappLink(s.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary">
                <Phone className="size-4" />
                {s.phone} · WhatsApp
              </a>
            ) : null}
            {s.email ? (
              <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                <Mail className="size-4" />
                {s.email}
              </a>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Truck className="size-4" />
              Despacho: {s.deliveryCost ? money(s.deliveryCost) : "gratis o sin definir"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              Proveedor desde {formatDate(s.createdAt, ctx.timezone)}
            </span>
          </div>
          {s.notes ? <p className="max-w-xl rounded-lg bg-muted/60 px-3 py-2 text-sm">{s.notes}</p> : null}
          {canManage && !s.phone && !s.email ? (
            <p className="text-xs text-muted-foreground">Agrega su teléfono (botón Editar) para escribirle por WhatsApp desde aquí.</p>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex items-center gap-2">
            <SupplierDialog
              id={s.id}
              currency={ctx.currency}
              initial={{
                name: s.name,
                phone: s.phone ?? "",
                email: s.email ?? "",
                products: s.products ?? "",
                deliveryCost: s.deliveryCost ?? 0,
                notes: s.notes ?? "",
              }}
            />
            <ConfirmDelete
              title="¿Eliminar este proveedor?"
              description="Sus gastos se mantienen en tu historial, pero sin el nombre del proveedor."
              onConfirm={deleteSupplier.bind(null, s.id)}
              redirectTo="/dashboard/proveedores"
            />
          </div>
        ) : null}
      </div>

      <div className={`grid gap-3 sm:grid-cols-3 ${STAT_GROUP}`}>
        <StatCard compactOnMobile label="Total comprado" value={money(detail.total)} icon={Wallet} tone="expenses" />
        <StatCard
          compactOnMobile
          label="Compras"
          value={String(detail.purchases)}
          icon={ReceiptText}
          hint={detail.last ? `Última: ${formatDate(detail.last, ctx.timezone)}` : "Aún no hay compras registradas."}
        />
        <StatCard
          compactOnMobile
          label="Compra promedio"
          value={money(detail.average)}
          icon={ReceiptText}
          hint="Lo que gastas en promedio cada vez que le compras."
        />
      </div>

      {detail.pending.length ? (
        <Card className={detail.pending.some((p) => daysUntil(p.dueDate, now, ctx.timezone) < 0) ? "border-danger/40" : "border-warning/40"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-warning" />
              Le debes {money(detail.pendingTotal)}
            </CardTitle>
            <CardDescription>Cuando pagues, márcalo como pagado y quedará registrado como compra.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-xl border">
              {detail.pending.map((p) => {
                const days = daysUntil(p.dueDate, now, ctx.timezone)
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.description}</p>
                      <p className="text-xs text-muted-foreground">vence el {formatDate(p.dueDate, ctx.timezone, { day: "numeric", month: "long" })}</p>
                    </div>
                    {days < 0 ? (
                      <Badge variant="destructive">
                        Atrasado {-days} {days === -1 ? "día" : "días"}
                      </Badge>
                    ) : days === 0 ? (
                      <Badge variant="destructive">Vence hoy</Badge>
                    ) : (
                      <Badge variant="secondary">{days === 1 ? "Mañana" : `En ${days} días`}</Badge>
                    )}
                    <span className="tabular w-24 text-right font-semibold">{money(p.amount)}</span>
                    {canManage ? <PayableActions id={p.id} label={p.description} /> : null}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Historial de compras</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.expenses.length === 0 ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Todavía no hay compras registradas a este proveedor.</p>
              <p>Al registrar un gasto, escribe “{s.name}” en Proveedor para que aparezca aquí.</p>
              <OpenQuickAction action="expense" label="Registrar gasto" />
            </div>
          ) : (
            <>
              <ul className="divide-y">
                {detail.expenses.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(e.date, ctx.timezone)}
                        {e.category ? ` · ${e.category.name}` : ""}
                      </p>
                    </div>
                    <span className="tabular font-semibold">{money(e.amount)}</span>
                  </li>
                ))}
              </ul>
              {detail.purchases > detail.expenses.length ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Mostramos las últimas {detail.expenses.length} compras.{" "}
                  <Button variant="link" className="h-auto p-0 text-xs" asChild>
                    <Link href="/dashboard/gastos">Ver todos los gastos</Link>
                  </Button>
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
