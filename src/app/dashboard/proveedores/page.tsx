import type { Metadata } from "next"
import { Mail, Phone, Receipt, Truck, Wallet } from "lucide-react"
import { ConfirmDelete } from "@/components/app/confirm-delete"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { StatCard } from "@/components/app/stat-card"
import { SupplierComparator } from "@/components/contacts/supplier-comparator"
import { SupplierDialog } from "@/components/contacts/supplier-dialog"
import { formatMoney, formatNumber } from "@/lib/currency"
import { formatDate } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { deleteSupplier } from "@/server/actions/contacts"
import { getSuppliers } from "@/server/queries/contacts"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Proveedores" }

export default async function SuppliersPage() {
  const ctx = await requireBusiness()
  if (!canUseFeature(ctx.business.plan, "suppliers")) {
    return <ProGate title="Proveedores" description="Ordena a tus proveedores y descubre cuál te conviene más." />
  }
  const suppliers = await getSuppliers(ctx.businessId)
  const money = (n: number) => formatMoney(n, ctx.currency)
  const canManage = can(ctx.role, "suppliers:manage")
  const totalSpent = suppliers.reduce((s, x) => s + x.spent, 0)
  const top = [...suppliers].sort((a, b) => b.spent - a.spent)[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proveedores"
        description="A quién le compras, cuánto le has comprado y cuál te conviene. Los gastos con proveedor se suman solos aquí."
        actions={canManage ? <SupplierDialog currency={ctx.currency} /> : null}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard compactOnMobile label="Proveedores" value={formatNumber(suppliers.length)} icon={Truck} />
        <StatCard compactOnMobile label="Total comprado" value={money(totalSpent)} icon={Wallet} tone="expenses"
          hint="Suma de los gastos registrados con proveedor." />
        <StatCard compactOnMobile label="Principal proveedor" value={top && top.spent > 0 ? top.name : "—"} icon={Receipt}
          hint={top && top.spent > 0 ? `${money(top.spent)} en ${top.purchases} compras.` : "Aún no hay gastos con proveedor."} />
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
            <ul className="grid gap-2">
              {suppliers.map((s) => (
                <li key={s.id} className="space-y-2 rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name}</p>
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
                      <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 hover:text-primary">
                        <Mail className="size-3.5" />
                        {s.email}
                      </a>
                    ) : null}
                    <span>Despacho: {s.deliveryCost ? money(s.deliveryCost) : "gratis o sin definir"}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
                    <span className="text-muted-foreground">
                      {s.purchases} {s.purchases === 1 ? "compra" : "compras"}
                      {s.lastPurchase ? ` · última ${formatDate(s.lastPurchase, ctx.timezone)}` : ""}
                    </span>
                    <span className="tabular font-semibold">{money(s.spent)}</span>
                  </div>
                  {s.notes ? <p className="text-xs text-muted-foreground">{s.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <SupplierComparator
          currency={ctx.currency}
          suppliers={suppliers.map((s) => ({ name: s.name, deliveryCost: s.deliveryCost }))}
        />
      </div>
    </div>
  )
}
