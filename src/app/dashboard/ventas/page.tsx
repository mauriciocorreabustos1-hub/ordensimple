import { allowsDecimals, quantityText } from "@/lib/units"
import type { Metadata } from "next"
import { CalendarDays, ShoppingBag, TrendingUp } from "lucide-react"
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
import { addDays, formatDate, formatTime } from "@/lib/dates"
import { can, canApproveDiscounts } from "@/lib/roles"
import { deleteSale } from "@/server/actions/sales"
import { EditSaleButton, type EditableSale } from "@/components/sales/edit-sale-button"
import { ReturnButton } from "@/components/sales/return-button"
import { SaleReceiptButton } from "@/components/sales/sale-receipt"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"
import { toDateKey } from "@/lib/dates"
import { listSales, parseRange, periodTotals } from "@/server/queries/records"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Ventas" }

function describe(items: { description: string; quantity: number; unit?: string }[]) {
  const first = items[0]
  if (!first) return "Venta"
  // Las devoluciones traen cantidades en negativo.
  const q = Math.abs(first.quantity)
  const text = allowsDecimals(first.unit) || q > 1 ? quantityText(q, first.unit, first.description) : first.description
  return items.length > 1 ? `${text} y ${items.length - 1} más` : text
}

/** Agrupa las ventas por día (vienen de la más nueva a la más antigua), como las páginas de un cuaderno. */
function byDay<T extends { date: Date; total: number }>(rows: T[], timeZone: string) {
  const groups: { key: string; date: Date; rows: T[]; total: number }[] = []
  for (const r of rows) {
    const key = toDateKey(r.date, timeZone)
    let g = groups.at(-1)
    if (!g || g.key !== key) {
      g = { key, date: r.date, rows: [], total: 0 }
      groups.push(g)
    }
    g.rows.push(r)
    g.total += r.total
  }
  return groups
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
          select: { id: true, name: true, price: true, stock: true, trackStock: true, saleUnit: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    canEdit
      ? db.customer.findMany({ where: { businessId: ctx.businessId }, select: { name: true }, orderBy: { name: "asc" }, take: 500 })
      : Promise.resolve([]),
  ])
  const customerNames = customers.map((c) => c.name)
  const days = byDay(list.rows, ctx.timezone)
  // Si quedan ventas por cargar, el último día puede estar incompleto: ahí no se muestra su total.
  const lastIsPartial = list.rows.length < list.count
  const now = new Date()
  const todayKey = toDateKey(now, ctx.timezone)
  const yesterdayKey = toDateKey(addDays(now, -1, ctx.timezone), ctx.timezone)
  const dayLabel = (key: string, date: Date) => {
    if (key === todayKey) return "Hoy"
    if (key === yesterdayKey) return "Ayer"
    const text = formatDate(date, ctx.timezone, { weekday: "long", day: "numeric", month: "long" })
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
  const daySummary = (g: (typeof days)[number], i: number) =>
    i === days.length - 1 && lastIsPartial
      ? null
      : `${g.rows.length} ${g.rows.length === 1 ? "venta" : "ventas"} · ${money(g.total)}`
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
  // Quién pidió y quién aprobó el descuento de una venta.
  const discountInfo = (s: (typeof list.rows)[number]) => {
    const d = s.discountRequest
    if (!d) return `Descuento de ${money(s.discount)}`
    const who = d.requestedByName === d.decidedByName ? `aplicado por ${d.requestedByName}` : `pedido por ${d.requestedByName}, aprobado por ${d.decidedByName}`
    return `Descuento de ${money(s.discount)}, ${who}. Motivo: ${d.reason}`
  }
  const canDelete = can(ctx.role, "sales:delete")
  // Devoluciones: cualquiera que vende puede pedirla; el encargado la aprueba.
  const canApprove = canApproveDiscounts(ctx.role)
  const title = (s: (typeof list.rows)[number]) => (s.returnOfId ? `Devolución: ${describe(s.items)}` : describe(s.items))
  const returnInfo = (s: (typeof list.rows)[number]) => {
    const back = -s.returnedBy.reduce((sum, r) => sum + r.total, 0)
    if (s.returnRequests.length) return { text: "Devolución pendiente de aprobación", tone: "pending" as const }
    if (back > 0) return { text: `Con devolución de ${money(back)}`, tone: "done" as const }
    return null
  }
  const returnButton = (s: (typeof list.rows)[number]) =>
    !s.returnOfId && s.total > 0 ? <ReturnButton saleId={s.id} currency={ctx.currency} timezone={ctx.timezone} canApprove={canApprove} /> : null
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
            {list.count - list.returnsCount} {list.count - list.returnsCount === 1 ? "venta" : "ventas"} en el período
            {list.returnsCount ? ` · devoluciones −${money(list.returned)}` : ""}
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
            <div className="space-y-5 md:hidden">
              {days.map((g, i) => (
                <section key={g.key} className="space-y-2">
                  <h3 className="flex items-baseline justify-between gap-3 border-b border-foreground/70 pb-1.5 text-sm">
                    <span className="font-semibold">{dayLabel(g.key, g.date)}</span>
                    <span className="tabular text-muted-foreground">{daySummary(g, i)}</span>
                  </h3>
                  <ul className="divide-y rounded-xl border bg-card">
                    {g.rows.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 p-3">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="flex items-baseline gap-2 text-sm">
                            <span className="min-w-0 flex-1 truncate font-medium" title={title(s)}>
                              {title(s)}
                            </span>
                            <span className={cn("tabular shrink-0 font-semibold", s.total < 0 && "text-danger")}>{money(s.total)}</span>
                          </p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {formatTime(s.date, ctx.timezone)} · {PAYMENT_LABEL[s.paymentMethod]}
                            {s.customer ? ` · ${s.customer.name}` : ""}
                            {s.createdBy && s.createdBy.id !== ctx.user.id ? ` · por ${s.createdBy.name.split(" ")[0]}` : ""}
                          </p>
                          {s.discount > 0 ? <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{discountInfo(s)}</p> : null}
                          {s.promoDiscount > 0 ? <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Promoción −{money(s.promoDiscount)}</p> : null}
                          {s.tip > 0 ? <p className="text-xs text-muted-foreground">+ propina {money(s.tip)} (aparte)</p> : null}
                          {returnInfo(s) ? (
                            <p className={cn("text-xs font-medium", returnInfo(s)?.tone === "pending" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                              {returnInfo(s)?.text}
                            </p>
                          ) : null}
                        </div>
                        <SaleReceiptButton saleId={s.id} />
                        {returnButton(s)}
                        {s.returnOfId ? null : editButton(s)}
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
                </section>
              ))}
            </div>

            {/* Computador: tabla */}
            <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-xs md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Hora</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {days.map((g, i) => [
                    <TableRow key={g.key} className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={4} className="pl-4 font-semibold">
                        {dayLabel(g.key, g.date)}
                      </TableCell>
                      <TableCell className="tabular text-right text-sm whitespace-nowrap text-muted-foreground">{daySummary(g, i)}</TableCell>
                      <TableCell />
                    </TableRow>,
                    ...g.rows.map((s) => (
                      <TableRow key={s.id} className="group">
                        <TableCell className="tabular pl-4 text-muted-foreground">{formatTime(s.date, ctx.timezone)}</TableCell>
                        <TableCell className="max-w-72">
                          <span className="flex items-center gap-2">
                            <span className="truncate">{title(s)}</span>
                            {s.tip > 0 ? (
                              <Badge variant="outline" className="shrink-0" title="La propina va aparte del total de la venta">
                                Propina {money(s.tip)}
                              </Badge>
                            ) : null}
                            {s.promoDiscount > 0 ? (
                              <Badge variant="outline" className="shrink-0 border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" title="Promociones y cupones">
                                Promo −{money(s.promoDiscount)}
                              </Badge>
                            ) : null}
                            {s.discount > 0 ? (
                              <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" title={discountInfo(s)}>
                                Desc. −{money(s.discount)}
                              </Badge>
                            ) : null}
                            {returnInfo(s) ? (
                              <Badge
                                variant="outline"
                                className={cn("shrink-0", returnInfo(s)?.tone === "pending" && "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300")}
                              >
                                {returnInfo(s)?.tone === "pending" ? "Devolución pendiente" : returnInfo(s)?.text.replace("Con devolución de ", "Devuelto ")}
                              </Badge>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell>
                          {PAYMENT_LABEL[s.paymentMethod]}
                          {s.createdBy && s.createdBy.id !== ctx.user.id ? (
                            <span className="block text-xs text-muted-foreground">por {s.createdBy.name.split(" ")[0]}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{s.customer?.name ?? ""}</TableCell>
                        <TableCell className={cn("tabular text-right font-semibold", s.total < 0 && "text-danger")}>{money(s.total)}</TableCell>
                        <TableCell className="pr-2">
                            {/* Con mouse, las acciones se aclaran hasta pasar por la fila; en pantallas táctiles siempre se ven. */}
                            <div className="flex items-center justify-end gap-1 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-fine:opacity-40">
                              <SaleReceiptButton saleId={s.id} />
                              {returnButton(s)}
                              {s.returnOfId ? null : editButton(s)}
                              {canDelete ? (
                                <ConfirmDelete
                                  title="¿Eliminar esta venta?"
                                  description={`Se eliminará la venta de ${money(s.total)} del ${formatDate(s.date, ctx.timezone)}. Si descontó stock, se devolverá.`}
                                  onConfirm={deleteSale.bind(null, s.id)}
                                />
                              ) : null}
                            </div>
                          </TableCell>
                      </TableRow>
                    )),
                  ])}
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
