import type { Metadata } from "next"
import Link from "next/link"
import { CalendarClock, Mail, Phone, Receipt, Truck, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PayableActions, PayableDialog } from "@/components/contacts/payables"
import { daysUntil, vatInfo } from "@/lib/vat"
import { getPayables } from "@/server/queries/payables"
import { ConfirmDelete } from "@/components/app/confirm-delete"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { StatCard, STAT_GROUP } from "@/components/app/stat-card"
import { SupplierComparator } from "@/components/contacts/supplier-comparator"
import { SupplierDialog } from "@/components/contacts/supplier-dialog"
import { formatMoney, formatNumber } from "@/lib/currency"
import { formatDate } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { deleteSupplier } from "@/server/actions/contacts"
import { getSuppliers } from "@/server/queries/contacts"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "Proveedores" }

export default async function SuppliersPage() {
  const ctx = await requireBusiness()
  requirePermission(ctx, "suppliers:manage")
  if (!canUseFeature(ctx.business.plan, "suppliers")) {
    return <ProGate title="Proveedores" description="Ordena a tus proveedores y descubre cuál te conviene más." />
  }
  const [suppliers, payables] = await Promise.all([getSuppliers(ctx.businessId), getPayables(ctx.businessId)])
  const now = new Date()
  const money = (n: number) => formatMoney(n, ctx.currency)
  const canManage = can(ctx.role, "suppliers:manage")
  const totalSpent = suppliers.reduce((s, x) => s + x.spent, 0)
  const top = [...suppliers].sort((a, b) => b.spent - a.spent)[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proveedores"
        description="A quién le compras, cuánto le has comprado y cuál te conviene. Cada gasto con proveedor crea su ficha y se suma solo."
        actions={canManage ? <SupplierDialog currency={ctx.currency} /> : null}
      />

      <Card
        id="pagos"
        className={`scroll-mt-20 ${payables.pending.some((p) => daysUntil(p.dueDate, now, ctx.timezone) < 0) ? "border-danger/40" : ""}`}
      >
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-warning" />
              Pagos pendientes
            </CardTitle>
            <CardDescription>
              {payables.pending.length
                ? `Debes ${money(payables.total)} a tus proveedores. Te avisamos por correo antes de cada vencimiento.`
                : "Anota las facturas que tienes que pagar y te avisamos antes de que venzan."}
            </CardDescription>
          </div>
          {canManage ? (
            <PayableDialog
              currency={ctx.currency}
              timezone={ctx.timezone}
              suppliers={suppliers.map((x) => x.name)}
              chargesVat={Boolean(vatInfo(ctx.business.country) && ctx.settings.chargesVat)}
            />
          ) : null}
        </CardHeader>
        {payables.pending.length || payables.paid.length ? (
          <CardContent className="space-y-3">
            {payables.pending.length ? (
              <ul className="divide-y rounded-xl border">
                {payables.pending.map((p) => {
                  const days = daysUntil(p.dueDate, now, ctx.timezone)
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.supplier?.name ? `${p.supplier.name} · ` : ""}vence el{" "}
                          {formatDate(p.dueDate, ctx.timezone, { day: "numeric", month: "long" })}
                        </p>
                      </div>
                      {days < 0 ? (
                        <Badge variant="destructive">
                          Atrasado {-days} {days === -1 ? "día" : "días"}
                        </Badge>
                      ) : days === 0 ? (
                        <Badge variant="destructive">Vence hoy</Badge>
                      ) : days <= 3 ? (
                        <Badge className="border-warning/40 bg-warning/15 text-foreground">
                          {days === 1 ? "Mañana" : `En ${days} días`}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">En {days} días</Badge>
                      )}
                      <span className="tabular w-24 text-right font-semibold">{money(p.amount)}</span>
                      {canManage ? <PayableActions id={p.id} label={p.description} /> : null}
                    </li>
                  )
                })}
              </ul>
            ) : null}
            {payables.paid.length ? (
              <p className="text-xs text-muted-foreground">
                Últimos pagados: {payables.paid.map((p) => `${p.description} (${money(p.amount)})`).join(" · ")}. Quedaron registrados en
                Gastos.
              </p>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      <div className={`grid gap-3 sm:grid-cols-3 ${STAT_GROUP}`}>
        <StatCard compactOnMobile label="Proveedores" value={formatNumber(suppliers.length)} icon={Truck} />
        <StatCard
          compactOnMobile
          label="Total comprado"
          value={money(totalSpent)}
          icon={Wallet}
          tone="expenses"
          hint="Suma de los gastos registrados con proveedor."
        />
        <StatCard
          compactOnMobile
          label="Principal proveedor"
          value={top && top.spent > 0 ? top.name : "—"}
          icon={Receipt}
          hint={top && top.spent > 0 ? `${money(top.spent)} en ${top.purchases} compras.` : "Aún no hay gastos con proveedor."}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="min-w-0 space-y-3">
          {suppliers.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Aún no tienes proveedores"
              description="Agrégalos aquí o escribe el proveedor al registrar un gasto: se creará solo."
              action={canManage ? <SupplierDialog currency={ctx.currency} /> : null}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {suppliers.map((s) => (
                <li key={s.id} className="space-y-2 rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/dashboard/proveedores/${s.id}`} className="block truncate font-medium hover:text-primary hover:underline">
                        {s.name}
                      </Link>
                      {s.products ? <p className="truncate text-sm text-muted-foreground">{s.products}</p> : null}
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 items-center gap-1">
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
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {s.phone ? (
                      <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                        <Phone className="size-3.5" />
                        {s.phone}
                      </a>
                    ) : null}
                    {s.email ? (
                      <a
                        href={`mailto:${s.email}`}
                        className="inline-flex max-w-full min-w-0 items-center gap-1 hover:text-primary"
                        title={s.email}
                      >
                        <Mail className="size-3.5 shrink-0" />
                        <span className="truncate">{s.email}</span>
                      </a>
                    ) : null}
                    <span>Despacho: {s.deliveryCost ? money(s.deliveryCost) : "gratis o sin definir"}</span>
                  </div>
                  <Link
                    href={`/dashboard/proveedores/${s.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm hover:text-primary"
                  >
                    <span className="text-muted-foreground">
                      {s.purchases} {s.purchases === 1 ? "compra" : "compras"}
                      {s.lastPurchase ? ` · última ${formatDate(s.lastPurchase, ctx.timezone)}` : ""}
                    </span>
                    <span className="tabular font-semibold">{money(s.spent)} · Ver ficha</span>
                  </Link>
                  {s.notes ? <p className="text-xs text-muted-foreground">{s.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <SupplierComparator currency={ctx.currency} suppliers={suppliers.map((s) => ({ name: s.name, deliveryCost: s.deliveryCost }))} />
      </div>
    </div>
  )
}
