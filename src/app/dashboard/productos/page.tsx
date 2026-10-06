import type { Metadata } from "next"
import { toDateKey } from "@/lib/dates"
import { AlertTriangle, Boxes, Package, PackageX } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfirmDelete } from "@/components/app/confirm-delete"
import { EmptyState } from "@/components/app/empty-state"
import { Explainer } from "@/components/app/explainer"
import { PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/app/stat-card"
import { ActiveSwitch } from "@/components/products/active-switch"
import { ProductDialog } from "@/components/products/product-dialog"
import type { ProductFormValues } from "@/components/products/product-form"
import { marginRatio } from "@/lib/calculations"
import { formatMoney, formatNumber, formatPercent, referenceAmount } from "@/lib/currency"
import { db } from "@/lib/db"
import { productLimit } from "@/lib/plans"
import { can } from "@/lib/roles"
import { deleteProduct } from "@/server/actions/products"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "Productos" }

type StockState = "ok" | "low" | "out" | "untracked"

function stockState(p: { trackStock: boolean; stock: number; minStock: number }): StockState {
  if (!p.trackStock) return "untracked"
  if (p.stock <= 0) return "out"
  if (p.stock <= p.minStock) return "low"
  return "ok"
}

function StockBadge({ state, stock }: { state: StockState; stock: number }) {
  if (state === "untracked") return <span className="text-xs text-muted-foreground">Sin control</span>
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
        {formatNumber(stock)} · bajo
      </Badge>
    )
  return <span className="tabular text-sm">{formatNumber(stock)}</span>
}

export default async function ProductsPage() {
  const ctx = await requireBusiness()
  requirePermission(ctx, "products:manage")
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { businessId: ctx.businessId },
      include: { category: { select: { name: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    db.category.findMany({ where: { businessId: ctx.businessId }, select: { name: true }, orderBy: { name: "asc" } }),
  ])
  const money = (n: number) => formatMoney(n, ctx.currency)
  const canManage = can(ctx.role, "products:manage")
  const categoryNames = categories.map((c) => c.name)
  const limit = productLimit(ctx.business.plan, ctx.business.extraProducts)
  const ref = referenceAmount(ctx.currency)

  const tracked = products.filter((p) => p.trackStock && p.active)
  const inventoryCost = tracked.reduce((s, p) => s + Math.max(0, p.stock) * p.cost, 0)
  const inventoryPrice = tracked.reduce((s, p) => s + Math.max(0, p.stock) * p.price, 0)
  const lowCount = tracked.filter((p) => stockState(p) === "low").length
  const outCount = tracked.filter((p) => stockState(p) === "out").length

  const toForm = (p: (typeof products)[number]): ProductFormValues => ({
    name: p.name,
    sku: p.sku ?? "",
    categoryName: p.category?.name ?? "",
    cost: p.cost,
    price: p.price,
    stock: p.stock,
    minStock: p.minStock,
    trackStock: p.trackStock,
    active: p.active,
    expiresAt: p.expiresAt ? toDateKey(p.expiresAt, ctx.timezone) : "",
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        description="Tu catálogo con costos y precios. Te mostramos cuánto ganas con cada uno."
        actions={canManage ? <ProductDialog currency={ctx.currency} categories={categoryNames} /> : null}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard compactOnMobile label="Productos" value={formatNumber(products.length)} icon={Package}
          hint={limit !== null ? `Tu plan permite hasta ${limit}.` : "Sin límite en tu plan."} />
        <StatCard compactOnMobile label="Valor del inventario" value={money(inventoryCost)} icon={Boxes} tone="sales"
          hint={`Lo que pagaste por el stock actual. Si lo vendes todo, entrarían ${money(inventoryPrice)}.`} />
        <StatCard compactOnMobile label="Por reponer" value={formatNumber(lowCount + outCount)} icon={AlertTriangle} tone={lowCount + outCount ? "expenses" : "default"}
          hint={`${outCount} ${outCount === 1 ? "agotado" : "agotados"} · ${lowCount} con stock bajo`} />
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aún no tienes productos"
          description="Agrega lo que vendes con su costo y precio. Así sabrás cuánto ganas con cada uno y podrás registrar ventas más rápido."
          action={canManage ? <ProductDialog currency={ctx.currency} categories={categoryNames} /> : null}
        />
      ) : (
        <>
          <ul className="grid gap-2 md:hidden">
            {products.map((p) => {
              const profit = p.price - p.cost
              return (
                <li key={p.id} className={`space-y-3 rounded-xl border bg-card p-3 ${p.active ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.category?.name ?? "Sin categoría"}
                        {p.sku ? ` · ${p.sku}` : ""}
                      </p>
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <ProductDialog productId={p.id} initial={toForm(p)} currency={ctx.currency} categories={categoryNames} />
                        <ConfirmDelete
                          title="¿Eliminar este producto?"
                          description={`"${p.name}" se eliminará. Las ventas anteriores se mantienen en tu historial.`}
                          onConfirm={deleteProduct.bind(null, p.id)}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Precio</p>
                      <p className="tabular font-medium">{money(p.price)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ganas</p>
                      <p className={`tabular font-medium ${profit <= 0 ? "text-danger" : ""}`}>{money(profit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Stock</p>
                      <StockBadge state={stockState(p)} stock={p.stock} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Producto</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Ganas por unidad</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Activo</TableHead>
                  {canManage ? <TableHead className="w-20" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const profit = p.price - p.cost
                  return (
                    <TableRow key={p.id} className={p.active ? "" : "opacity-60"}>
                      <TableCell className="max-w-64 pl-4">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.category?.name ?? "Sin categoría"}
                          {p.sku ? ` · ${p.sku}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="tabular text-right text-muted-foreground">{money(p.cost)}</TableCell>
                      <TableCell className="tabular text-right">{money(p.price)}</TableCell>
                      <TableCell className={`tabular text-right font-medium ${profit <= 0 ? "text-danger" : ""}`}>{money(profit)}</TableCell>
                      <TableCell className="tabular text-right">{formatPercent(marginRatio(p.price, p.cost), 0)}</TableCell>
                      <TableCell>
                        <StockBadge state={stockState(p)} stock={p.stock} />
                      </TableCell>
                      <TableCell>
                        <ActiveSwitch id={p.id} active={p.active} disabled={!canManage} />
                      </TableCell>
                      {canManage ? (
                        <TableCell className="pr-2">
                          <div className="flex items-center justify-end gap-1">
                            <ProductDialog productId={p.id} initial={toForm(p)} currency={ctx.currency} categories={categoryNames} />
                            <ConfirmDelete
                              title="¿Eliminar este producto?"
                              description={`"${p.name}" se eliminará. Las ventas anteriores se mantienen en tu historial.`}
                              onConfirm={deleteProduct.bind(null, p.id)}
                            />
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <Explainer title="¿Qué es el margen?">
            Es la parte del precio que te queda después de pagar el producto. Un margen de 40% significa que por cada{" "}
            {money(ref)} que vendes, unos {money(Math.round(ref * 0.4))} son ganancia antes de pagar arriendo, sueldos y
            otros gastos.
          </Explainer>
        </>
      )}
    </div>
  )
}
