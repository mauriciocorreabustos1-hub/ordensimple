import Link from "next/link"
import { Activity, BarChart3, Building2, Bug, CheckCircle2, Crown, Mail, Search, ShoppingBag, TicketPercent, UserPlus, Users } from "lucide-react"
import { ClearErrorsButton } from "@/components/admin/clear-errors-button"
import { CampaignComposer } from "@/components/admin/campaign-composer"
import { CouponManager, type CouponRow } from "@/components/admin/coupon-manager"
import { DeleteUserDialog } from "@/components/admin/delete-user-dialog"
import { PlanDialog } from "@/components/admin/plan-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/app/stat-card"
import { getAppUrl } from "@/lib/app-url"
import { formatNumber } from "@/lib/currency"
import { formatDate, formatDateTime } from "@/lib/dates"
import { couponSummary, effectivePlan, PLANS } from "@/lib/plans"
import { ROLE_LABEL } from "@/lib/roles"
import { isAdminEmail } from "@/server/admin"
import {
  getAdminStats,
  getPlanCounts,
  getRecentErrors,
  listAdminUsers,
  listCoupons,
  type AdminUserRow,
} from "@/server/queries/admin"
import { AUDIENCES, getAudienceCounts, listCampaigns, type Audience } from "@/server/queries/campaigns"

const TZ = "America/Santiago"

function lastSeen(u: AdminUserRow) {
  const at = u.sessions[0]?.updatedAt
  return at ? formatDateTime(at, TZ) : "—"
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : ""
  const page = Math.max(1, Number(params.pagina) || 1)
  const [stats, users, errors, coupons, planCounts, audience, campaigns] = await Promise.all([
    getAdminStats(),
    listAdminUsers({ q: q || undefined, page }),
    getRecentErrors(),
    listCoupons(),
    getPlanCounts(),
    getAudienceCounts(),
    listCampaigns(),
  ])
  const now = new Date()
  const longDate = (d: Date) => formatDate(d, TZ, { day: "numeric", month: "long", year: "numeric" })
  const couponRows: CouponRow[] = coupons.map((cp) => ({
    id: cp.id,
    code: cp.code,
    summary: couponSummary(cp),
    maxRedemptions: cp.maxRedemptions,
    uses: cp._count.redemptions,
    expiresLabel: cp.expiresAt ? longDate(cp.expiresAt) : null,
    expired: Boolean(cp.expiresAt && cp.expiresAt <= now),
    active: cp.active,
    note: cp.note,
  }))
  const maxSignups = Math.max(1, ...stats.signupsByDay.map((d) => d.count))

  const pageHref = (p: number) => `/admin?${new URLSearchParams({ ...(q ? { q } : {}), pagina: String(p) })}`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de administración"
        description="Cuentas, negocios y uso de OrdenSimple. Solo los administradores pueden ver esta página."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard compactOnMobile label="Usuarios" value={formatNumber(stats.users)} icon={Users} tone="profit"
          hint={`${stats.users7} nuevos esta semana · ${stats.users30} en 30 días`} />
        <StatCard compactOnMobile label="Negocios creados" value={formatNumber(stats.businesses)} icon={Building2}
          hint="Cuentas que terminaron la configuración inicial." />
        <StatCard compactOnMobile label="Negocios activos" value={formatNumber(stats.active7)} icon={Activity} tone="sales"
          hint={`Registraron ventas en los últimos 7 días (${stats.active30} en 30 días).`} />
        <StatCard compactOnMobile label="Registros totales" value={formatNumber(stats.sales + stats.expenses)} icon={ShoppingBag}
          hint={`${formatNumber(stats.sales)} ventas · ${formatNumber(stats.expenses)} gastos · ${formatNumber(stats.products)} productos`} />
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Crown className="size-4 text-warning" />
          Suscripciones
        </p>
        <div className="grid grid-cols-3 gap-2 text-center sm:max-w-md">
          {[
            { label: "con Pro", value: planCounts.pro },
            { label: "con Empresa", value: planCounts.business },
            { label: "vencidas", value: planCounts.expired },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-muted/50 px-2 py-2">
              <p className="tabular text-xl font-semibold">{formatNumber(s.value)}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Para dar un plan, busca al usuario y toca <strong>Plan</strong>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" />
            Cuentas nuevas por día
          </CardTitle>
          <CardDescription>Últimos 14 días.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-end gap-1.5" role="img" aria-label="Cuentas nuevas por día en los últimos 14 días">
            {stats.signupsByDay.map((d) => (
              <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="tabular text-[10px] text-muted-foreground">{d.count || ""}</span>
                <div
                  className="w-full max-w-6 rounded-t bg-chart-1"
                  style={{ height: `${d.count ? Math.max(6, (d.count / maxSignups) * 100) : 2}%`, opacity: d.count ? 1 : 0.25 }}
                  title={`${formatDate(d.day, TZ, { day: "numeric", month: "short" })}: ${d.count}`}
                />
                <span className="text-[10px] text-muted-foreground">{formatDate(d.day, TZ, { day: "numeric" })}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">
            Usuarios <span className="font-normal text-muted-foreground">({formatNumber(users.total)})</span>
          </h2>
          <form className="flex gap-2" action="/admin">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={q} placeholder="Buscar por nombre o correo" className="h-9 w-64 pl-9" />
            </div>
            <Button type="submit" variant="outline" size="lg">Buscar</Button>
          </form>
        </div>

        {users.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No se encontraron usuarios.</p>
        ) : (
          <div className="grid gap-2">
            {users.rows.map((u) => {
              const m = u.memberships[0]
              const b = m?.business
              return (
                <div key={u.id} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1.3fr_1.5fr_1fr_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="min-w-0 text-sm">
                    {b ? (
                      <>
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate">{b.name}</span>
                          <Badge variant={effectivePlan(b, now) === "FREE" ? "secondary" : "default"}>
                            {PLANS[effectivePlan(b, now)].name}
                          </Badge>
                          {m.role !== "OWNER" ? <Badge variant="outline">{ROLE_LABEL[m.role]}</Badge> : null}
                        </p>
                        {b.plan !== "FREE" && b.planExpiresAt ? (
                          <p className="text-xs text-muted-foreground">
                            {b.planExpiresAt > now
                              ? `${PLANS[b.plan].name} hasta el ${longDate(b.planExpiresAt)}`
                              : `Su plan ${PLANS[b.plan].name} venció el ${longDate(b.planExpiresAt)}`}
                          </p>
                        ) : null}
                        {b.discountPercent ? (
                          <p className="text-xs text-muted-foreground">Descuento guardado: {b.discountPercent}%</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {b.type ?? "Sin rubro"} · {formatNumber(b._count.sales)} ventas · {formatNumber(b._count.expenses)} gastos ·{" "}
                          {formatNumber(b._count.products)} productos
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Sin negocio (no terminó la configuración)</p>
                    )}
                    {u.memberships.length > 1 ? (
                      <p className="text-xs text-muted-foreground">+{u.memberships.length - 1} negocio(s) más</p>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>Registro: {formatDate(u.createdAt, TZ)}</p>
                    <p>Última vez: {lastSeen(u)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {b && m.role === "OWNER" ? (
                      <PlanDialog
                        businessId={b.id}
                        businessName={b.name}
                        currentPlan={effectivePlan(b, now)}
                        expiresLabel={b.planExpiresAt && b.planExpiresAt > now ? longDate(b.planExpiresAt) : null}
                      />
                    ) : null}
                    {b?._count.sales ? (
                      <Badge className="bg-success/15 text-success">Usando la app</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Sin ventas aún
                      </Badge>
                    )}
                    {isAdminEmail(u.email) ? null : (
                      <DeleteUserDialog
                        userId={u.id}
                        name={u.name}
                        email={u.email}
                        ownedBusinesses={u.memberships
                          .filter((x) => x.role === "OWNER")
                          .map((x) => ({ name: x.business.name, sales: x.business._count.sales, others: x.business._count.members - 1 }))}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {users.pages > 1 ? (
          <div className="flex items-center justify-center gap-3 text-sm">
            {page > 1 ? (
              <Button variant="outline" asChild>
                <Link href={pageHref(page - 1)}>Anterior</Link>
              </Button>
            ) : null}
            <span className="text-muted-foreground">
              Página {page} de {users.pages}
            </span>
            {page < users.pages ? (
              <Button variant="outline" asChild>
                <Link href={pageHref(page + 1)}>Siguiente</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section id="codigos" className="scroll-mt-20 space-y-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TicketPercent className="size-5 text-muted-foreground" />
            Códigos de descuento
          </h2>
          <p className="text-sm text-muted-foreground">
            Los clientes los canjean en Configuración → Tu plan. Los de días gratis activan el plan al tiro; los de porcentaje
            quedan guardados para cuando empieces a cobrar.
          </p>
        </div>
        <CouponManager coupons={couponRows} />
      </section>

      <section id="correos" className="scroll-mt-20 space-y-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Mail className="size-5 text-muted-foreground" />
            Correos de promoción
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatNumber(audience.counts.ALL)} de {formatNumber(audience.totalUsers)} usuarios aceptaron recibir ofertas. Envíate
            siempre una prueba antes de mandarlo a todos.
          </p>
        </div>
        <CampaignComposer
          appUrl={getAppUrl()}
          audiences={(Object.keys(AUDIENCES) as Audience[]).map((key) => ({
            value: key,
            label: AUDIENCES[key],
            count: audience.counts[key],
          }))}
          coupons={coupons
            .filter((cp) => cp.active && !(cp.expiresAt && cp.expiresAt <= now))
            .map((cp) => ({ code: cp.code, summary: couponSummary(cp) }))}
        />
        {campaigns.length ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Enviados</h3>
            <ul className="grid gap-2">
              {campaigns.map((cm) => (
                <li key={cm.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{cm.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {AUDIENCES[cm.audience as Audience] ?? cm.audience}
                      {cm.couponCode ? ` · código ${cm.couponCode}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(cm.sentAt ?? cm.createdAt, TZ)} · {formatNumber(cm.sentCount)} enviados
                    {cm.failedCount ? ` · ${formatNumber(cm.failedCount)} fallidos` : ""}
                    {!cm.sentAt ? " · en curso o interrumpido" : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section id="errores" className="scroll-mt-20 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bug className="size-5 text-muted-foreground" />
            Errores
            <span className="font-normal text-muted-foreground">
              ({formatNumber(errors.last24)} en las últimas 24 horas)
            </span>
          </h2>
          {errors.total ? <ClearErrorsButton /> : null}
        </div>
        {errors.rows.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" />
            No hay errores registrados. Si ocurre alguno, aparecerá aquí y te avisaremos por correo.
          </p>
        ) : (
          <ul className="grid gap-2">
            {errors.rows.map((e) => (
              <li key={e.id} className="space-y-1 rounded-xl border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {e.method ? `${e.method} ` : ""}
                    {e.path ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(e.createdAt, TZ)} · {e.source}
                  </span>
                </div>
                <p className="break-words text-destructive">{e.message}</p>
                {e.digest ? <p className="text-xs text-muted-foreground">Código: {e.digest}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <BarChart3 className="size-3.5" />
        Las visitas a la página (personas, países, dispositivos) se ven en Vercel → tu proyecto → Analytics.
      </p>
    </div>
  )
}
