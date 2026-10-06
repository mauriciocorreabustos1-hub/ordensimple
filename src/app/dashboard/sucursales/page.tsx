import type { Metadata } from "next"
import { Building2, PiggyBank, Receipt, ShoppingBag, TrendingDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/app/stat-card"
import { AddBranchButton, DeleteBranchButton, EnterBranchButton } from "@/components/branches/branch-actions"
import { formatMoney } from "@/lib/currency"
import { addDays, monthName, startOfDay, startOfMonth } from "@/lib/dates"
import { businessLimit } from "@/lib/plans"
import { ROLE_LABEL } from "@/lib/roles"
import { db } from "@/lib/db"
import { totalsBetween } from "@/server/queries/aggregates"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "Sucursales" }

export default async function BranchesPage() {
  const ctx = await requireBusiness()
  requirePermission(ctx, "finances:view")
  const now = new Date()

  // Negocios donde la persona puede ver los números (dueña o administradora).
  const memberships = await db.businessMember.findMany({
    where: { userId: ctx.user.id, role: { in: ["OWNER", "ADMIN"] }, business: { onboardingCompleted: true } },
    orderBy: { createdAt: "asc" },
    select: { role: true, business: { select: { id: true, name: true, currency: true, timezone: true, plan: true, type: true } } },
  })

  const rows = await Promise.all(
    memberships.map(async (m) => {
      const b = m.business
      const today = startOfDay(now, b.timezone)
      const tomorrow = addDays(today, 1, b.timezone)
      const [day, month] = await Promise.all([
        totalsBetween(b.id, today, tomorrow),
        totalsBetween(b.id, startOfMonth(now, b.timezone), tomorrow),
      ])
      return { ...b, role: m.role, day, month }
    }),
  )

  const owned = memberships.filter((m) => m.role === "OWNER")
  const limit = Math.max(businessLimit(ctx.business.plan), ...owned.map((o) => businessLimit(o.business.plan)))
  const disabledReason =
    ctx.role !== "OWNER"
      ? "Solo el dueño del negocio puede agregar sucursales."
      : owned.length >= limit
        ? `Tu plan permite hasta ${limit} negocios o sucursales.`
        : null

  // El total solo tiene sentido si todas usan la misma moneda.
  const currencies = new Set(rows.map((r) => r.currency))
  const sameCurrency = currencies.size === 1
  const currency = rows[0]?.currency ?? ctx.currency
  const money = (n: number, code = currency) => formatMoney(n, code)
  const total = rows.reduce(
    (acc, r) => ({ sales: acc.sales + r.month.sales, expenses: acc.expenses + r.month.expenses, profit: acc.profit + r.month.profit, today: acc.today + r.day.sales }),
    { sales: 0, expenses: 0, profit: 0, today: 0 },
  )
  const month = monthName(now, ctx.timezone)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sucursales"
        description={`Todas tus sucursales juntas: cómo va cada una en ${month} y cuál vende más.`}
        actions={<AddBranchButton disabledReason={disabledReason} />}
      />

      {sameCurrency && rows.length > 1 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Todas juntas · {month}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard compactOnMobile label="Ventas de hoy" value={money(total.today)} icon={ShoppingBag} tone="sales" />
            <StatCard compactOnMobile label="Ventas del mes" value={money(total.sales)} icon={ShoppingBag} tone="sales" />
            <StatCard compactOnMobile label="Gastos del mes" value={money(total.expenses)} icon={Receipt} tone="expenses" />
            <StatCard
              compactOnMobile
              label={total.profit >= 0 ? "Ganancia del mes" : "Pérdida del mes"}
              value={money(Math.abs(total.profit))}
              icon={total.profit >= 0 ? PiggyBank : TrendingDown}
              tone={total.profit >= 0 ? "profit" : "loss"}
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Cada sucursal · {rows.length} de {limit} en tu plan
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {[...rows]
            .sort((a, b) => b.month.sales - a.month.sales)
            .map((r, i) => (
              <Card key={r.id} className={r.id === ctx.businessId ? "border-primary/50" : undefined}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <Building2 className="size-4 text-primary" />
                      <span className="truncate">{r.name}</span>
                      {r.id === ctx.businessId ? <Badge variant="secondary">Estás aquí</Badge> : null}
                      {rows.length > 1 && i === 0 && r.month.sales > 0 ? <Badge className="bg-success/15 text-success">La que más vende</Badge> : null}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {r.type ?? "Sin rubro"} · {ROLE_LABEL[r.role]}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {r.id === ctx.businessId ? null : <EnterBranchButton businessId={r.id} />}
                    {r.role === "OWNER" && owned.length > 1 ? <DeleteBranchButton businessId={r.id} name={r.name} /> : null}
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">Hoy</dt>
                      <dd className="tabular font-semibold">{money(r.day.sales, r.currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Ventas del mes</dt>
                      <dd className="tabular font-semibold">{money(r.month.sales, r.currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Gastos del mes</dt>
                      <dd className="tabular font-semibold">{money(r.month.expenses, r.currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{r.month.profit >= 0 ? "Te quedó" : "Pérdida"}</dt>
                      <dd className={`tabular font-semibold ${r.month.profit >= 0 ? "text-success" : "text-danger"}`}>
                        {money(Math.abs(r.month.profit), r.currency)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
        </div>
      </section>

      {rows.length === 1 ? (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          ¿Tienes otro local? Agrega una sucursal: tendrá sus propias ventas, gastos, productos y caja, y aquí verás cómo
          va cada una comparada con las demás. Tu equipo puede trabajar en una sucursal sin ver las otras.
        </p>
      ) : null}
    </div>
  )
}
