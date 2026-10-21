import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import {
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Globe,
  Crown,
  Landmark,
  NotebookPen,
  PiggyBank,
  Receipt,
  ShoppingBag,
  TrendingDown,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InstallCard } from "@/components/app/install-app"
import { StatCard, ChangeBadge, DiffBadge, STAT_GROUP } from "@/components/app/stat-card"
import { AccountLine } from "@/components/app/account-line"
import { Explainer } from "@/components/app/explainer"
import { HealthCard } from "@/components/dashboard/health-card"
import { QuickButtons } from "@/components/dashboard/quick-buttons"
import { SalesExpensesChart } from "@/components/dashboard/sales-expenses-chart"
import { WelcomeToast } from "@/components/dashboard/welcome-toast"
import { businessHealth, percentChange } from "@/lib/calculations"
import { formatMoney, referenceAmount } from "@/lib/currency"
import { formatTime, greeting, monthName, zonedParts } from "@/lib/dates"
import { daysUntil, formatDueDate, ppmAmount, vatDueDate, vatInfo } from "@/lib/vat"
import { getDashboardData } from "@/server/queries/dashboard"
import { getInsights } from "@/server/queries/insights"
import { getDebtors } from "@/server/queries/fiado"
import { getYearSummary } from "@/server/queries/results"
import { payablesDueBefore } from "@/server/queries/payables"
import { addDays, startOfDay, startOfMonth } from "@/lib/dates"
import { MyGoalCard } from "@/components/dashboard/my-goal-card"
import { isServiceBusiness } from "@/lib/business-kind"
import { commissionOf, salesByMember } from "@/server/queries/team"
import { InsightsCard } from "@/components/dashboard/insights-card"
import { canUseFeature, memberLimit, PLANS, PLANS_ENFORCED, checkoutPath } from "@/lib/plans"
import { can } from "@/lib/roles"
import { requireBusiness } from "@/server/session"
import { db } from "@/lib/db"
import { FirstSteps, type FirstStep } from "@/components/dashboard/first-steps"
import { BusinessLogo } from "@/components/app/business-logo"

export const metadata: Metadata = { title: "Inicio" }

export default async function DashboardPage() {
  const ctx = await requireBusiness()
  const now = new Date()
  // Los empleados ven solo lo de hoy para registrar; las ganancias y comparaciones son del dueño.
  const showFinances = can(ctx.role, "finances:view")
  const showTips = showFinances && !ctx.settings.easyMode && canUseFeature(ctx.business.plan, "tips")
  // Lo que te deben, el IVA del mes y la utilidad (estado de resultados) para el dueño o administrador.
  const showMoneyBox = showFinances && !ctx.settings.easyMode
  const showFiado = showMoneyBox && canUseFeature(ctx.business.plan, "customers")
  const showResults = showMoneyBox && canUseFeature(ctx.business.plan, "results") && can(ctx.role, "reports:view")
  const vat = vatInfo(ctx.business.country)
  const chargesVat = Boolean(vat && ctx.settings.chargesVat)
  const today = zonedParts(now, ctx.timezone)
  const showPayables = showFinances && canUseFeature(ctx.business.plan, "suppliers") && can(ctx.role, "suppliers:manage")
  const hasGoal = Boolean(ctx.member.monthlyGoal || ctx.member.commissionRate)
  const nextMonth = startOfMonth(now, ctx.timezone, 1)
  const showAgenda =
    canUseFeature(ctx.business.plan, "agenda") &&
    (isServiceBusiness(ctx.business.type) || (await db.product.count({ where: { businessId: ctx.businessId, isService: true } })) > 0)
  const [data, insights, debts, year, payables, webOrders, mine, agendaToday] = await Promise.all([
    getDashboardData(ctx.businessId, ctx.timezone, now),
    showTips ? getInsights(ctx.businessId, ctx.timezone, ctx.currency, now) : Promise.resolve([]),
    showFiado ? getDebtors(ctx.businessId) : Promise.resolve(null),
    showResults
      ? getYearSummary(ctx.businessId, today.year, today.month, ctx.timezone, chargesVat ? vat!.rate : null)
      : Promise.resolve(null),
    showPayables ? payablesDueBefore(ctx.businessId, addDays(startOfDay(now, ctx.timezone), 8, ctx.timezone)) : Promise.resolve([]),
    ctx.business.storeSlug && canUseFeature(ctx.business.plan, "store")
      ? db.webOrder.count({ where: { businessId: ctx.businessId, status: "NEW" } })
      : Promise.resolve(0),
    hasGoal ? salesByMember(ctx.businessId, startOfMonth(now, ctx.timezone), nextMonth).then((m) => m.get(ctx.user.id)) : Promise.resolve(undefined),
    showAgenda
      ? db.appointment.findMany({
          where: {
            businessId: ctx.businessId,
            startAt: { gte: startOfDay(now, ctx.timezone), lt: addDays(startOfDay(now, ctx.timezone), 1, ctx.timezone) },
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            // Los empleados ven sus citas y las sin asignar; el dueño, todas.
            ...(showFinances ? {} : { OR: [{ staffId: ctx.user.id }, { staffId: null }] }),
          },
          select: { startAt: true, endAt: true, customerName: true, serviceName: true, status: true },
          orderBy: { startAt: "asc" },
        })
      : Promise.resolve([]),
  ])
  // Agenda de hoy (negocios de servicios): cuántas citas quedan y cuál es la próxima.
  const pendingToday = agendaToday.filter((a) => a.status !== "DONE")
  const nextUp = pendingToday.find((a) => a.endAt > now)
  const agendaCard = showAgenda ? (
    <Link href="/dashboard/agenda" className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <CalendarDays className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">
          {agendaToday.length ? `Hoy: ${agendaToday.length} cita${agendaToday.length === 1 ? "" : "s"}${agendaToday.length - pendingToday.length ? ` · ${agendaToday.length - pendingToday.length} cobrada${agendaToday.length - pendingToday.length === 1 ? "" : "s"}` : ""}` : "Hoy no tienes citas"}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {nextUp
            ? `Próxima: ${formatTime(nextUp.startAt, ctx.timezone)} · ${nextUp.customerName} (${nextUp.serviceName})`
            : agendaToday.length
              ? "Ya no quedan citas por atender hoy."
              : "Toca para agendar una."}
        </span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" />
    </Link>
  ) : null
  // Meta y comisión del mes de quien usa la app (las fija el dueño en Reportes → Tu equipo).
  const myNet = mine?.net ?? 0
  const goalCard = hasGoal ? (
    <MyGoalCard
      net={myNet}
      goal={ctx.member.monthlyGoal}
      rate={ctx.member.commissionRate}
      commission={commissionOf(myNet, ctx.member.commissionRate)}
      currency={ctx.currency}
      month={monthName(now, ctx.timezone)}
      daysLeft={Math.max(0, Math.round((nextMonth.getTime() - startOfDay(now, ctx.timezone).getTime()) / 86_400_000))}
    />
  ) : null
  const webOrdersBanner = webOrders ? (
    <Link
      href="/dashboard/pedidos"
      className="flex items-center gap-3 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 hover:bg-primary/10"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Globe className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">
          {webOrders === 1 ? "Tienes 1 pedido web nuevo" : `Tienes ${webOrders} pedidos web nuevos`}
        </span>
        <span className="block text-sm text-muted-foreground">Confírmalo por WhatsApp y regístralo como venta.</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" />
    </Link>
  ) : null
  const payablesTotal = payables.reduce((sum, p) => sum + p.amount, 0)
  const overduePayables = payables.filter((p) => p.dueDate < startOfDay(now, ctx.timezone)).length
  const thisMonth = year?.rows[today.month - 1] ?? null
  const vatDue = vatDueDate(today.year, today.month, ctx.settings.vatDueDay, ctx.timezone, ctx.business.country)
  // En Chile el F29 junta el IVA y el PPM.
  const ppm = thisMonth && ctx.business.country === "CL" ? ppmAmount(thisMonth.s.netSales, ctx.settings.ppmRate) : 0
  const f29 = (thisMonth?.vatToPay ?? 0) + ppm
  const vatDaysLeft = daysUntil(vatDue, now, ctx.timezone)
  const money = (n: number) => formatMoney(n, ctx.currency)
  const easy = ctx.settings.easyMode
  // Primeros pasos: para el dueño o administrador, hasta que el negocio quede andando.
  const counts = showFinances
    ? await db.business.findUnique({
        where: { id: ctx.businessId },
        select: { _count: { select: { products: true, sales: true, expenses: true, cashClosings: true, members: true } } },
      })
    : null
  const firstSteps: FirstStep[] | null = counts
    ? (
        [
        {
          key: "producto",
          label: "Crea tu primer producto",
          hint: "Con su precio y cuánto te cuesta.",
          done: counts._count.products > 0,
          href: "/dashboard/productos",
        },
        {
          key: "venta",
          label: "Registra tu primera venta",
          hint: "Con el botón verde, o escaneando.",
          done: counts._count.sales > 0,
          action: "sale",
        },
        { key: "gasto", label: "Anota un gasto", hint: "Arriendo, luz, mercadería…", done: counts._count.expenses > 0, action: "expense" },
        {
          key: "caja",
          label: "Cierra la caja al final del día",
          hint: "Cuenta el efectivo y mira si cuadra.",
          done: counts._count.cashClosings > 0,
          href: "/dashboard/caja",
        },
        {
          key: "equipo",
          label: "Invita a tu equipo",
          hint: "Si alguien más vende contigo.",
          done: counts._count.members > 1,
          href: "/dashboard/configuracion?seccion=equipo",
        },
      ] as FirstStep[]
      ).filter(
        (s) =>
          (s.key !== "caja" || canUseFeature(ctx.business.plan, "cashClose")) &&
          (s.key !== "equipo" || memberLimit(ctx.business.plan, ctx.business.extraMembers) > 1),
      )
    : null

  const health = businessHealth({
    sales: data.last30.sales,
    expenses: data.last30.expenses,
    prevSales: data.prev30.sales,
  })

  const daysWithoutSales = data.lastSaleAt ? Math.floor((now.getTime() - data.lastSaleAt.getTime()) / 86_400_000) : null

  const ref = referenceAmount(ctx.currency)
  const monthMargin = data.month.sales > 0 ? data.month.profit / data.month.sales : null
  const currentMonth = monthName(now, ctx.timezone)

  if (!showFinances) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {greeting(now, ctx.timezone)}, {ctx.user.name.split(" ")[0]}
          </p>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight md:text-3xl">
            {ctx.business.logoUpdatedAt ? (
              <BusinessLogo
                businessId={ctx.businessId}
                name={ctx.business.name}
                logoUpdatedAt={ctx.business.logoUpdatedAt}
                className="size-11 rounded-xl border"
              />
            ) : null}
            <span className="min-w-0">{ctx.business.name}</span>
          </h1>
        </div>
        <QuickButtons />
        {agendaCard}
        {webOrdersBanner}
        {goalCard}
        <section aria-labelledby="hoy" className="space-y-3" data-tour="cuenta-hoy">
          <h2 id="hoy" className="text-base font-semibold">
            Hoy en el negocio
          </h2>
          <div className={`grid gap-3 ${STAT_GROUP} sm:grid-cols-2`}>
            <StatCard
              label="Ventas hoy"
              value={money(data.today.sales)}
              icon={ShoppingBag}
              tone="sales"
              size="lg"
              hint={data.today.salesCount === 1 ? "1 venta registrada" : `${data.today.salesCount} ventas registradas`}
            />
            <StatCard label="Gastos hoy" value={money(data.today.expenses)} icon={Receipt} tone="expenses" size="lg" />
          </div>
        </section>
        <p className="text-center text-sm text-muted-foreground">
          Anota cada venta y gasto apenas ocurra. Al cerrar el día, haz el{" "}
          <Link href="/dashboard/caja" className="text-primary hover:underline">
            cierre de caja
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Suspense>
        <WelcomeToast />
      </Suspense>

      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {greeting(now, ctx.timezone)}, {ctx.user.name.split(" ")[0]}
        </p>
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight md:text-3xl">
          {ctx.business.logoUpdatedAt ? (
            <BusinessLogo
              businessId={ctx.businessId}
              name={ctx.business.name}
              logoUpdatedAt={ctx.business.logoUpdatedAt}
              className="size-11 rounded-xl border"
            />
          ) : null}
          <span className="min-w-0">{ctx.business.name}</span>
        </h1>
      </div>

      {firstSteps ? <FirstSteps businessId={ctx.businessId} steps={firstSteps} /> : null}
      <InstallCard />

      <HealthCard health={health} />

      {PLANS_ENFORCED && ctx.business.plan === "FREE" && ctx.role === "OWNER" && PLANS.PRO.monthlyPrice ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent/40 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <Crown className="size-4 shrink-0 text-warning" />
            Estás en el plan Gratis. Con Pro ({formatMoney(PLANS.PRO.monthlyPrice, "CLP")} al mes) ves tu utilidad real y tu F29, el flujo
            de caja con lo que viene, todo tu historial, merma y vencidos, y vendes escaneando sin parar.
          </span>
          <Link href={checkoutPath("pro")} className="shrink-0 font-medium text-primary hover:underline">
            Pasar a Pro
          </Link>
        </div>
      ) : null}

      {daysWithoutSales !== null && daysWithoutSales >= 3 ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <CalendarClock className="size-4 shrink-0 text-warning" />
          No has registrado ventas durante {daysWithoutSales} días. Si vendiste, anótalo para que tus números estén al día.
        </div>
      ) : null}

      {payables.length ? (
        <Link
          href="/dashboard/proveedores#pagos"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors hover:bg-accent/40 ${overduePayables ? "border-danger/40 bg-danger/5" : "bg-card"}`}
        >
          <CalendarClock className={`size-4 shrink-0 ${overduePayables ? "text-danger" : "text-warning"}`} />
          <span className="flex-1">
            {overduePayables
              ? `Tienes ${overduePayables} pago${overduePayables === 1 ? "" : "s"} a proveedores atrasado${overduePayables === 1 ? "" : "s"}.`
              : `Esta semana vence${payables.length === 1 ? "" : "n"} ${payables.length} pago${payables.length === 1 ? "" : "s"} a proveedores.`}{" "}
            Total: <strong className="tabular">{money(payablesTotal)}</strong>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      <QuickButtons />
        {agendaCard}
        {webOrdersBanner}
        {goalCard}

      <section aria-labelledby="hoy" className="space-y-3" data-tour="cuenta-hoy">
        <h2 id="hoy" className="text-base font-semibold">
          Hoy
        </h2>
        <AccountLine
          size={easy ? "lg" : "default"}
          positive={data.today.profit >= 0}
          empty={!data.today.sales && !data.today.expenses ? "Hoy todavía no anotas ventas ni gastos. Cuando registres una venta, aquí verás cuánto te va quedando." : null}
          sales={{
            label: "Vendiste",
            value: money(data.today.sales),
            sub: data.today.salesCount === 1 ? "1 venta" : `${data.today.salesCount} ventas`,
          }}
          expenses={{ label: "Gastaste", value: money(data.today.expenses) }}
          result={{ label: data.today.profit >= 0 ? "Te quedó (aprox.)" : "Perdiste (aprox.)", value: money(Math.abs(data.today.profit)) }}
        />
      </section>

      {debts || thisMonth ? (
        <section aria-labelledby="cuentas" className="space-y-3">
          <h2 id="cuentas" className="text-base font-semibold">
            Tus cuentas de {currentMonth}
          </h2>
          <div
            className={`grid gap-3 ${STAT_GROUP} ${[debts, thisMonth, chargesVat && thisMonth].filter(Boolean).length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
          >
            {debts ? (
              <LinkCard
                href="/dashboard/clientes?segmento=deben"
                icon={NotebookPen}
                label="Te deben (fiado)"
                value={money(debts.total)}
                tone="text-warning"
                hint={
                  debts.count === 0
                    ? "Nadie te debe"
                    : debts.count === 1
                      ? "1 cliente con deuda · ver quién"
                      : `${debts.count} clientes con deuda · ver quiénes`
                }
              />
            ) : null}
            {thisMonth ? (
              <LinkCard
                href="/dashboard/resultados"
                icon={thisMonth.s.profit >= 0 ? PiggyBank : TrendingDown}
                label={thisMonth.s.profit >= 0 ? "Utilidad del mes" : "Pérdida del mes"}
                value={money(Math.abs(thisMonth.s.profit))}
                tone={thisMonth.s.profit >= 0 ? "text-success" : "text-danger"}
                hint={`Descontando lo que te costó lo vendido${chargesVat ? ` y sin ${vat!.label}` : ""} · ver estado de resultados`}
              />
            ) : null}
            {chargesVat && thisMonth ? (
              <LinkCard
                href="/dashboard/resultados"
                icon={Landmark}
                label={ppm > 0 ? "F29 a pagar (aprox.)" : `${vat!.label} a pagar (aprox.)`}
                value={money(f29)}
                tone="text-primary"
                hint={
                  f29 > 0
                    ? `${ppm > 0 ? `${vat!.label} ${money(thisMonth.vatToPay)} + PPM ${money(ppm)} · ` : ""}Vence el ${formatDueDate(vatDue, ctx.timezone)} · faltan ${vatDaysLeft} días`
                    : thisMonth.carryOut > 0
                      ? `Por ahora no te toca pagar: tienes ${money(thisMonth.carryOut)} a favor`
                      : "Este mes, por ahora, no te toca pagar"
                }
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {easy ? (
        <p className="text-center text-sm text-muted-foreground">
          Estás en Modo Fácil.{" "}
          <Link href="/dashboard/configuracion" className="text-primary hover:underline">
            Ver más detalles
          </Link>
        </p>
      ) : (
        <>
          <section aria-labelledby="mes" className="space-y-3">
            <h2 id="mes" className="text-base font-semibold">
              Este mes ({currentMonth})
            </h2>
            <AccountLine
              positive={data.month.profit >= 0}
              empty={!data.month.sales && !data.month.expenses ? "Este mes todavía no hay ventas ni gastos anotados." : null}
              sales={{
                label: "Vendiste",
                value: money(data.month.sales),
                sub: <ChangeBadge change={percentChange(data.month.sales, data.prevMonth.sales)} label="vs. mismas fechas del mes pasado" />,
              }}
              expenses={{
                label: "Gastaste",
                value: money(data.month.expenses),
                sub: (
                  <ChangeBadge
                    change={percentChange(data.month.expenses, data.prevMonth.expenses)}
                    label="vs. mismas fechas del mes pasado"
                    invert
                  />
                ),
              }}
              result={{
                label: data.month.profit >= 0 ? "Te quedó" : "Perdiste",
                value: money(Math.abs(data.month.profit)),
                sub: (
                  <DiffBadge current={data.month.profit} previous={data.prevMonth.profit} money={money} label="vs. mismas fechas del mes pasado" />
                ),
              }}
            />
            {monthMargin !== null && monthMargin > 0 ? (
              <Explainer title="En palabras simples">
                Este mes, por cada {money(ref)} que vendes, aproximadamente {money(Math.round(ref * monthMargin))} te quedan como ganancia
                después de tus gastos registrados.
              </Explainer>
            ) : null}
          </section>

          {showTips ? <InsightsCard insights={insights} limit={4} /> : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Últimos 7 días</CardTitle>
                <CardDescription>Lo que vendiste y gastaste cada día.</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesExpensesChart data={data.last7} currency={ctx.currency} caption="Ventas y gastos de cada uno de los últimos 7 días" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Últimos 6 meses</CardTitle>
                <CardDescription>Cómo ha evolucionado tu negocio mes a mes.</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesExpensesChart
                  data={data.months}
                  currency={ctx.currency}
                  caption="Ventas y gastos de cada uno de los últimos 6 meses"
                />
              </CardContent>
            </Card>
          </div>

          <section aria-labelledby="comparar" className="space-y-3">
            <h2 id="comparar" className="text-base font-semibold">
              Comparaciones
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <ComparisonCard
                title="Esta semana vs. semana pasada"
                note="Desde el lunes hasta hoy, comparado con los mismos días de la semana pasada."
                current={data.week.sales}
                previous={data.prevWeek.sales}
                currentProfit={data.week.profit}
                previousProfit={data.prevWeek.profit}
                money={money}
              />
              <ComparisonCard
                title="Este mes vs. mes anterior"
                note="Desde el día 1 hasta hoy, comparado con las mismas fechas del mes pasado."
                current={data.month.sales}
                previous={data.prevMonth.sales}
                currentProfit={data.month.profit}
                previousProfit={data.prevMonth.profit}
                money={money}
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function LinkCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  href: string
  icon: LucideIcon
  label: string
  value: string
  hint: string
  tone: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 md:p-5"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className={`size-4 ${tone}`} />
          {label}
        </p>
        <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

function ComparisonCard({
  title,
  note,
  current,
  previous,
  currentProfit,
  previousProfit,
  money,
}: {
  title: string
  note: string
  current: number
  previous: number
  currentProfit: number
  previousProfit: number
  money: (n: number) => string
}) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 md:p-5">
      <p className="font-medium">{title}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-3 *:min-w-fit *:flex-1">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Ventas</p>
          <p className="tabular text-lg font-semibold">{money(current)}</p>
          <p className="tabular text-xs text-muted-foreground">antes: {money(previous)}</p>
          <ChangeBadge change={percentChange(current, previous)} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Ganancia aprox.</p>
          <p className={`tabular text-lg font-semibold ${currentProfit < 0 ? "text-danger" : ""}`}>{money(currentProfit)}</p>
          <p className="tabular text-xs text-muted-foreground">antes: {money(previousProfit)}</p>
          <DiffBadge current={currentProfit} previous={previousProfit} money={money} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  )
}
