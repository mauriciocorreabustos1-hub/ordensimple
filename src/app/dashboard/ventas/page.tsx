import type { Metadata } from "next"
import { CalendarDays, ShoppingBag, TrendingUp, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfirmDelete } from "@/components/app/confirm-delete"
import { DateRangeFilter } from "@/components/app/date-range-filter"
import { EmptyState } from "@/components/app/empty-state"
import { LoadMore } from "@/components/app/load-more"
import { OpenQuickAction } from "@/components/app/open-quick-action"
import { PageHeader } from "@/components/app/page-header"
import { StatCard, STAT_GROUP } from "@/components/app/stat-card"
import { PAYMENT_LABEL } from "@/lib/constants"
import { formatMoney } from "@/lib/currency"
import { formatDate, formatDateTime } from "@/lib/dates"
import { can } from "@/lib/roles"
import { deleteSale } from "@/server/actions/sales"
import { EditSaleButton, type EditableSale } from "@/components/sales/edit-sale-button"
import { db } from "@/lib/db"
import { toDateKey } from "@/lib/dates"
import { listSales, parseRange, periodTotals } from "@/server/queries/records"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Ventas" }

function describe(items: { description: string; quantity: number }[]) {
  const first = items[0]
  if (!first) return "Venta"
  const text = first.quantity > 1 ? `${first.quantity} × ${first.description}` : first.description
  return items.length > 1 ? `${text} y ${items.length - 1} más` : text
}

export default async function SalesPage({ searchParams }: PageProps<"/dashboard/ventas">) {
  const ctx = await requireBusiness()
  const params = await searchParams
  const range = parseRange({ desde: params.desde as string, hasta: params.hasta as string, pagina: params.pagina as string }, ctx.timezone)
  const canEdit = can(ctx.role, "sales:edit")
  const [[today, month], list, products, customers] = await Promise.all([
    periodTotals(ctx.businessId, ctx.timezone),
    listSales(ctx.businessId, range.from, range.to, range.take),
    canEdit
      ? db.product.findMany({
          where: { businessId: ctx.businessId },
          select: { id: true, name: true, price: true, stock: true, trackStock: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    canEdit
      ? db.customer.findMany({ where: { businessId: ctx.businessId }, select: { name: true }, orderBy: { name: "asc" }, take: 500 })
      : Promise.resolve([]),
  ])
  const customerNames = customers.map((c) => c.name)
  const toEditable = (s: (typeof list.rows)[number]): EditableSale => ({
    id: s.id,
    isQuick: s.isQuick,
    total: s.total,
    paymentMethod: s.paymentMethod,
    date: toDateKey(s.date, ctx.timezone),
    customerName: s.customer?.name ?? "",
    note: s.note ?? "",
    lines: s.items.map((i) => ({ productId: i.productId, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
  })
  const editButton = (s: (typeof list.rows)[number]) =>
    canEdit ? (
      <EditSaleButton sale={toEditable(s)} currency={ctx.currency} timezone={ctx.timezone} products={products} customers={customerNames} />
    ) : null
  const money = (n: number) => formatMoney(n, ctx.currency)
  const canDelete = can(ctx.role, "sales:delete")
  const avg = month.salesCount ? Math.round(month.sales / month.salesCount) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventas"
        description="Todo lo que has vendido. Registra cada venta para saber cuánto entra a tu negocio."
        actions={<OpenQuickAction action="sale" label="Registrar venta" />}
      />

      <div className={`grid gap-3 sm:grid-cols-3 ${STAT_GROUP}`}>
        <StatCard
          compactOnMobile
          label="Ventas hoy"
          value={money(today.sales)}
          icon={ShoppingBag}
          tone="sales"
          hint={`${today.salesCount} ${today.salesCount === 1 ? "venta" : "ventas"}`}
        />
        <StatCard
          compactOnMobile
          label="Ventas del mes"
          value={money(month.sales)}
          icon={TrendingUp}
          tone="sales"
          hint={`${month.salesCount} ${month.salesCount === 1 ? "venta" : "ventas"} este mes`}
        />
        <StatCard
          compactOnMobile
          label="Venta promedio"
          value={money(avg)}
          icon={CalendarDays}
          hint="En promedio, esto es lo que te compra cada cliente este mes."
        />
      </div>

      <section className="space-y-4">
        <DateRangeFilter desde={range.desde} hasta={range.hasta} timezone={ctx.timezone} />
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">
            {list.count} {list.count === 1 ? "venta" : "ventas"} en el período
          </span>
          <span className="tabular font-semibold">{money(list.total)}</span>
        </div>

        {list.rows.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No hay ventas en estas fechas"
            description="Cuando registres una venta aparecerá aquí."
            action={<OpenQuickAction action="sale" label="Registrar venta" />}
          />
        ) : (
          <>
            {/* Celular: tarjetas */}
            <ul className="grid grid-cols-1 gap-2 md:hidden">
              {list.rows.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex items-baseline gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium" title={describe(s.items)}>
                        {describe(s.items)}
                      </span>
                      <span className="tabular shrink-0 font-semibold">{money(s.total)}</span>
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {formatDateTime(s.date, ctx.timezone)} · {PAYMENT_LABEL[s.paymentMethod]}
                      {s.customer ? ` · ${s.customer.name}` : ""}
                    </p>
                  </div>
                  {editButton(s)}
                  {canDelete ? (
                    <ConfirmDelete
                      title="¿Eliminar esta venta?"
                      description={`Se eliminará la venta de ${money(s.total)}. Si descontó stock, se devolverá.`}
                      onConfirm={deleteSale.bind(null, s.id)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>

            {/* Computador: tabla */}
            <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Fecha</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {canDelete || canEdit ? <TableHead className="w-20" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="pl-4 text-muted-foreground">{formatDateTime(s.date, ctx.timezone)}</TableCell>
                      <TableCell className="max-w-72">
                        <span className="flex items-center gap-2">
                          <span className="truncate">{describe(s.items)}</span>
                          {s.isQuick ? (
                            <Badge variant="secondary" className="gap-1">
                              <Zap className="size-3" />
                              Rápida
                            </Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>{PAYMENT_LABEL[s.paymentMethod]}</TableCell>
                      <TableCell className="text-muted-foreground">{s.customer?.name ?? "—"}</TableCell>
                      <TableCell className="tabular text-right font-medium">{money(s.total)}</TableCell>
                      {canDelete || canEdit ? (
                        <TableCell className="pr-2">
                          <div className="flex items-center justify-end gap-1">
                            {editButton(s)}
                            {canDelete ? (
                              <ConfirmDelete
                                title="¿Eliminar esta venta?"
                                description={`Se eliminará la venta de ${money(s.total)} del ${formatDate(s.date, ctx.timezone)}. Si descontó stock, se devolverá.`}
                                onConfirm={deleteSale.bind(null, s.id)}
                              />
                            ) : null}
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <LoadMore
              pathname="/dashboard/ventas"
              desde={range.desde}
              hasta={range.hasta}
              page={range.page}
              shown={list.rows.length}
              total={list.count}
            />
          </>
        )}
      </section>
    </div>
  )
}
