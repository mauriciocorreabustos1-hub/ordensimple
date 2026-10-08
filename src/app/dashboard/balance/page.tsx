import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, ChevronRight, Landmark, Package, PiggyBank, Scale, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDelete } from "@/components/app/confirm-delete"
import { Explainer } from "@/components/app/explainer"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { AmountSetting, LoanDialog, PayInstallmentButton, WithdrawalDialog } from "@/components/balance/balance-forms"
import { db } from "@/lib/db"
import { formatMoney } from "@/lib/currency"
import { formatDate, toDateKey } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { vatInfo } from "@/lib/vat"
import { deleteLoan, deleteWithdrawal } from "@/server/actions/balance"
import { getBalance } from "@/server/queries/balance"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Balance y retiros" }

export default async function BalancePage() {
  const ctx = await requireBusiness()
  if (!can(ctx.role, "finances:view")) redirect("/dashboard")
  if (!canUseFeature(ctx.business.plan, "balance")) {
    return (
      <ProGate
        title="Balance y retiros"
        description="Cuánto vale tu negocio (lo que tienes menos lo que debes), la plata que sacas para ti y tus préstamos."
      />
    )
  }

  const [b, products] = await Promise.all([
    getBalance(ctx),
    db.product.findMany({
      where: { businessId: ctx.businessId, active: true },
      select: { id: true, name: true, cost: true, stock: true, trackStock: true },
      orderBy: { name: "asc" },
    }),
  ])
  const money = (n: number) => formatMoney(n, ctx.currency)
  const vat = vatInfo(ctx.business.country)
  const w = b.withdrawals
  const overSalary = w.salary ? w.total - w.salary : 0
  const maxNet = Math.max(1, ...b.snapshots.map((s) => Math.abs(s.net)))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Balance y retiros"
        description="Cuánto vale tu negocio hoy, cuánta plata sacas para ti y lo que debes."
        actions={<WithdrawalDialog currency={ctx.currency} today={toDateKey(new Date(), ctx.timezone)} products={products} vatRate={vat && ctx.settings.chargesVat ? vat.rate : null} />}
      />

      {/* ─── Balance ─────────────────────────────────────────────────────── */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            Cuánto vale tu negocio hoy
          </CardTitle>
          <CardDescription>Lo que tienes menos lo que debes. Es un cálculo aproximado con tus datos de la app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className={cn("tabular text-4xl font-semibold tracking-tight", b.net < 0 && "text-danger")}>{money(b.net)}</p>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: "Lo que tienes", icon: ArrowDownLeft, tone: "text-success", rows: b.assets, total: b.totalAssets },
              { title: "Lo que debes", icon: ArrowUpRight, tone: "text-danger", rows: b.liabilities, total: b.totalLiabilities },
            ].map((col) => (
              <div key={col.title} className="rounded-xl border p-4">
                <p className="mb-2 flex items-center gap-2 font-semibold">
                  <col.icon className={cn("size-4", col.tone)} />
                  {col.title}
                </p>
                <ul className="divide-y text-sm">
                  {col.rows.map((r) => (
                    <li key={r.key} className="flex items-center justify-between gap-3 py-2.5">
                      {r.href ? (
                        <Link href={r.href} className="hover:text-primary hover:underline">
                          {r.label}
                        </Link>
                      ) : (
                        <span>{r.label}</span>
                      )}
                      <span className={cn("tabular font-medium", "missing" in r && r.missing && "text-muted-foreground")}>
                        {"missing" in r && r.missing ? "Falta" : money(r.value)}
                      </span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-3 pt-3 font-semibold">
                    <span>Total</span>
                    <span className="tabular">{money(col.total)}</span>
                  </li>
                </ul>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-xl bg-muted/50 p-4">
            <p className="text-sm font-medium">
              {b.cashSince ? "Plata en caja y banco" : "¿Cuánta plata tienes hoy en caja y banco?"}
            </p>
            <p className="text-xs text-muted-foreground">
              {b.cashSince
                ? `Partiste con lo que anotaste el ${formatDate(b.cashSince, ctx.timezone, { day: "numeric", month: "long" })} y desde ahí sumamos lo que anotas que entra (ventas cobradas y abonos) y restamos lo que sale (gastos y retiros). Si no calza con lo que tienes, corrígelo aquí.`
                : "Cuenta la caja y mira tu cuenta del banco, y anota el total. Desde ahí la app lo sigue sola con tus ventas, gastos y retiros."}
            </p>
            <div className="max-w-sm">
              <AmountSetting field="openingCash" value={b.cashSince ? b.assets.find((a) => a.key === "cash")!.value : null} currency={ctx.currency} label="Plata en caja y banco hoy" button={b.cashSince ? "Corregir" : "Guardar"} />
            </div>
          </div>

          {b.snapshots.length > 1 ? (
            <div>
              <p className="mb-2 text-sm font-medium">Cómo ha cambiado (lo que vale tu negocio, mes a mes)</p>
              <div className="flex h-28 items-end gap-2" role="img" aria-label="Valor del negocio mes a mes">
                {b.snapshots.map((s) => (
                  <div key={s.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${s.label}: ${money(s.net)}`}>
                    <div
                      className={cn("w-full max-w-8 rounded-t", s.net >= 0 ? "bg-chart-1" : "bg-danger")}
                      style={{ height: `${Math.max(4, (Math.abs(s.net) / maxNet) * 100)}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground capitalize">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Cada mes guardamos cómo quedó tu balance para que veas si tu negocio va creciendo.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ─── Retiros del dueño ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-5 text-primary" />
              Retiros del dueño este mes
            </CardTitle>
            <CardDescription>La plata o productos que sacas para ti. No es gasto: la ganancia del negocio no baja.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Ganó el negocio</p>
                <p className={cn("tabular text-lg font-semibold", w.profit < 0 && "text-danger")}>{money(w.profit)}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Te llevaste</p>
                <p className="tabular text-lg font-semibold">{money(w.total)}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Quedó en el negocio</p>
                <p className={cn("tabular text-lg font-semibold", w.leftInBusiness < 0 ? "text-danger" : "text-success")}>{money(w.leftInBusiness)}</p>
              </div>
            </div>

            {w.total > 0 && w.leftInBusiness < 0 ? (
              <p className="flex gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
                <span>
                  Este mes sacaste <strong>{money(-w.leftInBusiness)}</strong> más de lo que ganó el negocio: esa plata sale del
                  capital (mercadería, caja). Si pasa varios meses seguidos, el negocio se va achicando.
                </span>
              </p>
            ) : null}

            <div className="space-y-2 rounded-xl border p-3">
              <p className="font-medium">Tu sueldo de dueño</p>
              <p className="text-xs text-muted-foreground">Cuánto quieres sacar al mes. Te avisamos si te pasas.</p>
              <AmountSetting field="ownerSalary" value={w.salary} currency={ctx.currency} label="Sueldo del dueño al mes" />
              {w.salary ? (
                <div className="space-y-1 pt-1">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", overSalary > 0 ? "bg-danger" : "bg-primary")} style={{ width: `${Math.min(100, (w.total / w.salary) * 100)}%` }} />
                  </div>
                  <p className={cn("text-xs", overSalary > 0 ? "text-danger" : "text-muted-foreground")}>
                    {overSalary > 0 ? `Te pasaste ${money(overSalary)} de tu sueldo.` : `Llevas ${money(w.total)} de ${money(w.salary)}.`}
                  </p>
                </div>
              ) : null}
            </div>

            {w.list.length ? (
              <ul className="divide-y rounded-xl border px-3">
                {w.list.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        {r.kind === "GOODS" ? <Package className="size-3.5 text-muted-foreground" /> : <Wallet className="size-3.5 text-muted-foreground" />}
                        <span className="truncate">{r.kind === "GOODS" ? `${r.quantity} × ${r.note ?? "productos"}` : (r.note ?? "Retiro")}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(r.date, ctx.timezone, { day: "numeric", month: "short" })} ·{" "}
                        {r.kind === "GOODS" ? "productos (al costo)" : r.source === "BANK" ? "del banco" : "de la caja"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="tabular font-medium">{money(r.amount)}</span>
                      <ConfirmDelete
                        title="¿Borrar este retiro?"
                        description={r.kind === "GOODS" ? "Las unidades vuelven al stock." : "Se quita del cierre de caja y del flujo de caja."}
                        onConfirm={deleteWithdrawal.bind(null, r.id)}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Este mes no has anotado retiros. Usa «Anotar retiro» cuando saques plata o productos para ti.</p>
            )}

            {w.byMonth.length > 1 ? (
              <p className="text-xs text-muted-foreground">
                Meses anteriores:{" "}
                {w.byMonth
                  .slice(0, -1)
                  .map((m) => {
                    const [y, mo] = m.month.split("-").map(Number)
                    return `${formatDate(new Date(Date.UTC(y, mo - 1, 15)), "UTC", { month: "long" })} ${money(m.total)}`
                  })
                  .join(" · ")}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* ─── Préstamos ────────────────────────────────────────────────── */}
        <Card id="prestamos">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Landmark className="size-5 text-primary" />
                Préstamos y deudas
              </CardTitle>
              <CardDescription>Lo que el negocio debe: créditos, tarjetas, plata que te prestaron.</CardDescription>
            </div>
            <LoanDialog currency={ctx.currency} />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {b.loans.length ? (
              <ul className="divide-y rounded-xl border px-3">
                {b.loans.map((l) => {
                  const days = b.nextDue(l.dueDay)
                  return (
                    <li key={l.id} className="space-y-2 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{l.lender}</span>
                          <span className="text-xs text-muted-foreground">
                            {l.installment ? `Cuota ${money(l.installment)}` : "Sin cuota fija"}
                            {l.dueDay ? ` · paga el día ${l.dueDay}` : ""}
                            {l.note ? ` · ${l.note}` : ""}
                          </span>
                        </span>
                        <span className="tabular shrink-0 font-semibold">{money(l.balance)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {days !== null && days <= 5 ? (
                          <Badge className="border-warning/40 bg-warning/15 text-foreground">{days === 0 ? "La cuota vence hoy" : `La cuota vence en ${days} ${days === 1 ? "día" : "días"}`}</Badge>
                        ) : null}
                        <span className="ml-auto flex items-center gap-1">
                          {l.installment && l.balance > 0 ? <PayInstallmentButton id={l.id} label={l.lender} /> : null}
                          <LoanDialog currency={ctx.currency} loan={{ id: l.id, lender: l.lender, balance: l.balance, installment: l.installment, dueDay: l.dueDay, note: l.note }} />
                          <ConfirmDelete title={`¿Borrar «${l.lender}»?`} description="Se quita del balance." onConfirm={deleteLoan.bind(null, l.id)} />
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground">No tienes préstamos anotados. Si el negocio debe plata, agrégala para que el balance sea real.</p>
            )}
            <p className="text-xs text-muted-foreground">
              «Pagué la cuota» descuenta la cuota completa de lo que debes. Si parte era interés, corrige el saldo con el lápiz.
            </p>
          </CardContent>
        </Card>
      </div>

      <Explainer title="¿Para qué me sirve el balance?">
        Te dice si tu negocio está creciendo de verdad: si cada mes vale más, vas bien aunque algún mes vendas menos. También te
        muestra si tienes mucha plata parada en mercadería o en fiado, y es lo primero que te pide el banco si quieres un
        crédito. La utilidad (en Resultados) es lo que ganaste en el mes; el balance es lo que tienes acumulado.
      </Explainer>

      <Link href="/dashboard/resultados" className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm hover:bg-accent/40">
        <span className="flex items-center gap-2">
          <PiggyBank className="size-4 text-primary" />
          Ver cuánto ganó el negocio este mes (Resultados e IVA)
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    </div>
  )
}
