import type { Metadata } from "next"
import { PieChart, Receipt, Wallet } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfirmDelete } from "@/components/app/confirm-delete"
import { DateRangeFilter } from "@/components/app/date-range-filter"
import { EmptyState } from "@/components/app/empty-state"
import { LoadMore } from "@/components/app/load-more"
import { OpenQuickAction } from "@/components/app/open-quick-action"
import { PageHeader } from "@/components/app/page-header"
import { StatCard, STAT_GROUP } from "@/components/app/stat-card"
import { formatMoney, formatPercent } from "@/lib/currency"
import { formatDate, startOfMonth } from "@/lib/dates"
import { can } from "@/lib/roles"
import { deleteExpense } from "@/server/actions/expenses"
import { EditExpenseButton } from "@/components/expenses/edit-expense-button"
import { db } from "@/lib/db"
import { toDateKey } from "@/lib/dates"
import { expensesByCategory, listExpenses, parseRange, periodTotals } from "@/server/queries/records"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Gastos" }

export default async function ExpensesPage({ searchParams }: PageProps<"/dashboard/gastos">) {
  const ctx = await requireBusiness()
  const params = await searchParams
  const range = parseRange({ desde: params.desde as string, hasta: params.hasta as string, pagina: params.pagina as string }, ctx.timezone)
  const now = new Date()
  const canEdit = can(ctx.role, "expenses:edit")
  const [[today, month], list, byCategory, categories] = await Promise.all([
    periodTotals(ctx.businessId, ctx.timezone, now),
    listExpenses(ctx.businessId, range.from, range.to, range.take),
    expensesByCategory(ctx.businessId, startOfMonth(now, ctx.timezone), startOfMonth(now, ctx.timezone, 1)),
    canEdit
      ? db.expenseCategory.findMany({
          where: { businessId: ctx.businessId },
          select: { id: true, name: true },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        })
      : Promise.resolve([]),
  ])
  const editButton = (e: (typeof list.rows)[number]) =>
    canEdit ? (
      <EditExpenseButton
        currency={ctx.currency}
        timezone={ctx.timezone}
        categories={categories}
        chargesVat={ctx.settings.chargesVat}
        expense={{
          id: e.id,
          amount: e.amount,
          description: e.description,
          categoryId: e.categoryId ?? undefined,
          date: toDateKey(e.date, ctx.timezone),
          supplierName: e.supplier?.name ?? "",
          hasInvoice: e.hasInvoice,
        }}
      />
    ) : null
  const money = (n: number) => formatMoney(n, ctx.currency)
  const canDelete = can(ctx.role, "expenses:delete")
  const top = byCategory[0]
  const maxCat = top?.total ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gastos"
        description="Lo que sale de tu negocio: arriendo, cuentas, proveedores, sueldos y más."
        actions={<OpenQuickAction action="expense" label="Registrar gasto" />}
      />

      <div className={`grid gap-3 sm:grid-cols-3 ${STAT_GROUP}`}>
        <StatCard compactOnMobile label="Gastos hoy" value={money(today.expenses)} icon={Receipt} tone="expenses" />
        <StatCard
          compactOnMobile
          label="Gastos del mes"
          value={money(month.expenses)}
          icon={Wallet}
          tone="expenses"
          hint={month.sales > 0 ? `Equivale al ${formatPercent(month.expenses / month.sales, 0)} de lo que vendiste este mes.` : undefined}
        />
        <StatCard
          compactOnMobile
          label="En lo que más gastas"
          value={top ? top.name : "—"}
          icon={PieChart}
          hint={top ? `${money(top.total)} este mes` : "Aún no hay gastos este mes"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="min-w-0 space-y-4">
          <DateRangeFilter desde={range.desde} hasta={range.hasta} timezone={ctx.timezone} />
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {list.count} {list.count === 1 ? "gasto" : "gastos"} en el período
            </span>
            <span className="tabular font-semibold">{money(list.total)}</span>
          </div>

          {list.rows.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No hay gastos en estas fechas"
              description="Registra tus gastos para saber cuánto te queda de verdad."
              action={<OpenQuickAction action="expense" label="Registrar gasto" />}
            />
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-2 md:hidden">
                {list.rows.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="flex items-baseline gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate font-medium" title={e.description}>
                          {e.description}
                        </span>
                        <span className="tabular shrink-0 font-semibold">{money(e.amount)}</span>
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {formatDate(e.date, ctx.timezone)} · {e.category?.name ?? "Sin categoría"}
                        {e.supplier ? ` · ${e.supplier.name}` : ""}
                      </p>
                    </div>
                    {editButton(e)}
                    {canDelete ? (
                      <ConfirmDelete
                        title="¿Eliminar este gasto?"
                        description={`Se eliminará "${e.description}" por ${money(e.amount)}.`}
                        onConfirm={deleteExpense.bind(null, e.id)}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      {canDelete || canEdit ? <TableHead className="w-20" /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.rows.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="pl-4 text-muted-foreground">{formatDate(e.date, ctx.timezone)}</TableCell>
                        <TableCell className="max-w-64 truncate">{e.description}</TableCell>
                        <TableCell>{e.category?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{e.supplier?.name ?? "—"}</TableCell>
                        <TableCell className="tabular text-right font-medium">{money(e.amount)}</TableCell>
                        {canDelete || canEdit ? (
                          <TableCell className="pr-2">
                            <div className="flex items-center justify-end gap-1">
                              {editButton(e)}
                              {canDelete ? (
                                <ConfirmDelete
                                  title="¿Eliminar este gasto?"
                                  description={`Se eliminará "${e.description}" por ${money(e.amount)}.`}
                                  onConfirm={deleteExpense.bind(null, e.id)}
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
                pathname="/dashboard/gastos"
                desde={range.desde}
                hasta={range.hasta}
                page={range.page}
                shown={list.rows.length}
                total={list.count}
              />
            </>
          )}
        </section>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>¿En qué se va tu plata?</CardTitle>
            <CardDescription>Gastos de este mes por categoría.</CardDescription>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay gastos este mes.</p>
            ) : (
              <ul className="space-y-3">
                {byCategory.map((c) => (
                  <li key={c.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">{c.name}</span>
                      <span className="tabular shrink-0 font-medium">{money(c.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-chart-2" style={{ width: `${Math.max(3, (c.total / maxCat) * 100)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatPercent(month.expenses ? c.total / month.expenses : 0, 0)} de tus gastos del mes
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
