import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, CalendarClock, ClipboardCheck, PackageX, Snail, Trash2, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/app/empty-state"
import { Explainer } from "@/components/app/explainer"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { StatCard } from "@/components/app/stat-card"
import { MovementDialog } from "@/components/inventory/movement-dialog"
import { ProductLookup, type LookupProduct } from "@/components/inventory/product-lookup"
import { formatMoney, formatNumber } from "@/lib/currency"
import { formatDate, formatDateTime } from "@/lib/dates"
import { daysUntil } from "@/lib/vat"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { getInventory, type StockState } from "@/server/queries/inventory"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Inventario" }

const FILTERS: { value: "todos" | StockState; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "low", label: "Stock bajo" },
  { value: "out", label: "Agotados" },
  { value: "ok", label: "Con stock" },
]

const MOVEMENT = {
  IN: { label: "Entrada", icon: ArrowDownToLine },
  OUT: { label: "Salida", icon: ArrowUpFromLine },
  ADJUSTMENT: { label: "Ajuste", icon: ClipboardCheck },
  WASTE: { label: "Merma", icon: Trash2 },
} as const

function StateBadge({ state }: { state: StockState }) {
  if (state === "out")
    return (
      <Badge variant="destructive" className="gap-1">
        <PackageX className="size-3" />
        Agotado
      </Badge>
    )
  if (state === "low")
    return (
      <Badge className="gap-1 border-warning/40 bg-warning/15 text-foreground">
        <AlertTriangle className="size-3 text-warning" />
        Bajo
      </Badge>
    )
  return <Badge variant="secondary">OK</Badge>
}

export default async function InventoryPage({ searchParams }: PageProps<"/dashboard/inventario">) {
  const ctx = await requireBusiness()
  if (!canUseFeature(ctx.business.plan, "inventory")) {
    return <ProGate title="Inventario" description="Controla tu stock, recibe alertas y registra movimientos." />
  }
  const params = await searchParams
  const filter = FILTERS.some((f) => f.value === params.filtro) ? (params.filtro as (typeof FILTERS)[number]["value"]) : "todos"
  const inv = await getInventory(ctx.businessId, ctx.timezone)
  const money = (n: number) => formatMoney(n, ctx.currency)
  const canManage = can(ctx.role, "inventory:manage")
  // Los empleados manejan el stock, pero no ven cuánto costó.
  const showCosts = can(ctx.role, "finances:view")
  const items = filter === "todos" ? inv.items : inv.items.filter((i) => i.state === filter)
  const alerts = [...inv.out, ...inv.low]
  const now = new Date()
  const lookup: LookupProduct[] = inv.lookup.map((p) => ({
    ...p,
    cost: showCosts ? p.cost : null,
    expires: p.expiresAt
      ? { label: formatDate(p.expiresAt, ctx.timezone, { day: "numeric", month: "long" }), days: daysUntil(p.expiresAt, now, ctx.timezone) }
      : null,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description="Cuánto tienes de cada producto, qué se está acabando y qué no se mueve."
        actions={
          inv.productOptions.length ? (
            <>
              {lookup.some((p) => p.codes.length) ? (
                <ProductLookup products={lookup} currency={ctx.currency} movementProducts={canManage ? inv.productOptions : undefined} />
              ) : null}
              {canManage ? <MovementDialog products={inv.productOptions} /> : null}
            </>
          ) : null
        }
      />

      {inv.productOptions.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Aún no tienes productos"
          description="Crea tus productos con su stock y aquí verás cuánto te queda de cada uno."
          action={
            <Link href="/dashboard/productos" className="text-sm font-medium text-primary hover:underline">
              Ir a Productos
            </Link>
          }
        />
      ) : (
        <>
          <div className={cn("grid gap-3 sm:grid-cols-2", showCosts ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
            {showCosts ? (
              <StatCard compactOnMobile label="Valor del inventario" value={money(inv.value)} icon={Boxes} tone="sales"
                hint={`Lo que pagaste por tu stock. A precio de venta son ${money(inv.valueAtPrice)}.`} />
            ) : null}
            <StatCard compactOnMobile label="Unidades en stock" value={formatNumber(inv.units)} icon={TrendingUp}
              hint={`${inv.items.length} productos con control de stock.`} />
            <StatCard compactOnMobile label="Stock bajo" value={formatNumber(inv.low.length)} icon={AlertTriangle}
              tone={inv.low.length ? "expenses" : "default"} hint="Quedan menos unidades que tu mínimo." />
            <StatCard compactOnMobile label="Agotados" value={formatNumber(inv.out.length)} icon={PackageX}
              tone={inv.out.length ? "loss" : "default"} hint="Productos sin unidades disponibles." />
          </div>

          <Card className={inv.expiring.some((p) => daysUntil(p.expiresAt, new Date(), ctx.timezone) < 0) ? "border-danger/40" : undefined}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-warning" />
                  Merma y vencidos
                </CardTitle>
                <CardDescription>
                  {inv.waste.units
                    ? `Este mes perdiste ${formatNumber(inv.waste.units)} ${inv.waste.units === 1 ? "unidad" : "unidades"}${showCosts ? ` (${money(inv.waste.cost)} a costo)` : ""}.`
                    : "Este mes no has registrado merma."}
                </CardDescription>
              </div>
              {canManage ? <MovementDialog products={inv.productOptions} defaultType="WASTE" compact label="Registrar merma" /> : null}
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Por vencer (7 días)</p>
                {inv.expiring.length ? (
                  <ul className="space-y-1.5">
                    {inv.expiring.slice(0, 8).map((p) => {
                      const days = daysUntil(p.expiresAt, new Date(), ctx.timezone)
                      return (
                        <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                          <span className="min-w-0 truncate">
                            {p.name}
                            <span className="text-xs text-muted-foreground"> · {formatNumber(p.stock)} u. · {formatDate(p.expiresAt, ctx.timezone, { day: "numeric", month: "short" })}</span>
                          </span>
                          {days < 0 ? (
                            <Badge variant="destructive">Vencido</Badge>
                          ) : days === 0 ? (
                            <Badge variant="destructive">Vence hoy</Badge>
                          ) : (
                            <Badge className="border-warning/40 bg-warning/15 text-foreground">{days === 1 ? "Mañana" : `En ${days} días`}</Badge>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nada por vencer. Agrega la fecha de vencimiento al editar cada producto.</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Merma del mes por motivo</p>
                {inv.waste.byReason.length ? (
                  <ul className="space-y-1.5">
                    {inv.waste.byReason.map((r) => (
                      <li key={r.reason} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                        <span>{r.reason}</span>
                        <span className="tabular text-muted-foreground">
                          {formatNumber(r.units)} u.{showCosts ? ` · ${money(r.cost)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Cuando algo se venza o se dañe, regístralo como merma para saber cuánta plata se pierde.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {alerts.length ? (
            <Card className="border-warning/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-warning" />
                  Por reponer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {alerts.slice(0, 8).map((p) => (
                    <li key={p.id} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                      {p.state === "out"
                        ? `Se agotó ${p.name}.`
                        : `Te ${p.stock === 1 ? "queda 1 unidad" : `quedan ${formatNumber(p.stock)} unidades`} de ${p.name}.`}
                    </li>
                  ))}
                </ul>
                {alerts.length > 8 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Y {alerts.length - 8} productos más.</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="min-w-0 space-y-4">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {FILTERS.map((f) => (
                  <Link
                    key={f.value}
                    href={f.value === "todos" ? "/dashboard/inventario" : `/dashboard/inventario?filtro=${f.value}`}
                    scroll={false}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1 text-sm",
                      filter === f.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                    )}
                  >
                    {f.label}
                  </Link>
                ))}
              </div>

              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  {inv.items.length === 0
                    ? "Ninguno de tus productos tiene control de stock. Actívalo al editar un producto o registra una entrada."
                    : "No hay productos en este filtro."}
                </p>
              ) : (
                <ul className="grid gap-2">
                  {items.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Mínimo {formatNumber(p.minStock)} · vendiste {formatNumber(p.sold30)} en 30 días
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("tabular text-lg font-semibold", p.state === "out" && "text-danger")}>
                          {formatNumber(p.stock)}
                        </p>
                        {showCosts ? (
                          <p className="text-xs text-muted-foreground">{money(Math.max(0, p.stock) * p.cost)}</p>
                        ) : null}
                      </div>
                      <StateBadge state={p.state} />
                      {canManage ? <MovementDialog products={inv.productOptions} defaultProductId={p.id} compact /> : null}
                    </li>
                  ))}
                </ul>
              )}
              {inv.untrackedCount ? (
                <p className="text-xs text-muted-foreground">
                  {inv.untrackedCount} producto(s) sin control de stock (por ejemplo, servicios) no aparecen aquí.
                </p>
              ) : null}
            </section>

            <aside className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Más vendidos</CardTitle>
                  <CardDescription>Unidades vendidas en los últimos 30 días.</CardDescription>
                </CardHeader>
                <CardContent>
                  {inv.topSellers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aún no hay ventas con productos.</p>
                  ) : (
                    <ol className="space-y-2.5">
                      {inv.topSellers.map((p, i) => (
                        <li key={p.id} className="flex items-center gap-3 text-sm">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                          <span className="tabular font-medium">{formatNumber(p.qty)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Snail className="size-4 text-muted-foreground" />
                    Sin movimiento
                  </CardTitle>
                  <CardDescription>Productos con stock que no se vendieron en 30 días.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {inv.idle.length === 0 ? (
                    <p className="text-sm text-muted-foreground">¡Bien! Todo tu stock se está moviendo.</p>
                  ) : (
                    <>
                      <ul className="space-y-2">
                        {inv.idle.slice(0, 5).map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate">{p.name}</span>
                            {showCosts ? (
                              <span className="tabular shrink-0 text-muted-foreground">{money(p.value)}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      {showCosts ? (
                        <Explainer title="Dinero inmovilizado">
                          Tienes {money(inv.idleValue)} en productos que no se están vendiendo. Considera una oferta para
                          convertirlos en plata.
                        </Explainer>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Últimos movimientos</CardTitle>
              <CardDescription>Entradas, salidas, ajustes y ventas que cambiaron tu stock.</CardDescription>
            </CardHeader>
            <CardContent>
              {inv.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>
              ) : (
                <ul className="divide-y">
                  {inv.movements.map((m) => {
                    const meta = MOVEMENT[m.type]
                    return (
                      <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <meta.icon className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">
                            <span className="font-medium">{m.product.name}</span> · {m.reason ?? meta.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(m.createdAt, ctx.timezone)}
                            {m.createdBy ? ` · ${m.createdBy.name}` : ""}
                          </p>
                        </div>
                        <span className={cn("tabular font-semibold", m.quantity > 0 ? "text-success" : "text-danger")}>
                          {m.quantity > 0 ? "+" : ""}
                          {formatNumber(m.quantity)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
