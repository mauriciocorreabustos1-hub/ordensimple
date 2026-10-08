import Link from "next/link"
import { Activity, BarChart3, Download, MailCheck, Megaphone, NotebookPen, Building2, Bug, CheckCircle2, Crown, Mail, MonitorSmartphone, Search, ShoppingBag, TicketPercent, UserPlus, Users } from "lucide-react"
import { ClearErrorsButton } from "@/components/admin/clear-errors-button"
import { CampaignComposer } from "@/components/admin/campaign-composer"
import { DirectEmailComposer } from "@/components/admin/direct-email-composer"
import { ExtrasDialog } from "@/components/admin/extras-dialog"
import { db } from "@/lib/db"
import { mercadoPagoAccount } from "@/lib/mercadopago"
import { BILLING_ENABLED, PLANS_ENFORCED } from "@/lib/plans"
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
import { formatMoney, formatNumber } from "@/lib/currency"
import { formatDate, formatDateTime } from "@/lib/dates"
import { couponSummary, effectivePlan, PLANS } from "@/lib/plans"
import { ROLE_LABEL } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { ago, device } from "@/lib/activity-format"
import { isAdminEmail } from "@/server/admin"
import { getFeatureAdoption, getOriginStats } from "@/server/queries/admin-detail"
import { countUnverified } from "@/server/verify-reminders"
import { VerifyLinksButton } from "@/components/admin/verify-links-button"
import { originLabel } from "@/lib/signup-source"
import {
  ACTIVITY_FILTERS,
  ROLE_FILTERS,
  countUsersByRole,
  getBusinessActivity,
  type ActivityFilter,
  type RoleFilter,
  getAdminStats,
  getPlanCounts,
  getRecentErrors,
  listAdminUsers,
  listCoupons,
  type AdminUserRow,
} from "@/server/queries/admin"
import { AUDIENCES, getAudienceCounts, listCampaigns, type Audience } from "@/server/queries/campaigns"

const TZ = "America/Santiago"

function lastSeen(u: AdminUserRow, now: Date) {
  const at = u.lastActiveAt ?? u.sessions[0]?.updatedAt
  return at ? { label: ago(at, now), title: formatDateTime(at, TZ), days: (now.getTime() - at.getTime()) / 86_400_000 } : null
}


/** "a@x.cl, b@y.cl y 3 más" */
function shortList(emails: string | null, count: number) {
  const list = emails ? emails.split(", ") : []
  if (list.length === 0) return `${count} personas`
  return list.length > 3 ? `${list.slice(0, 3).join(", ")} y ${list.length - 3} más` : list.join(", ")
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : ""
  const page = Math.max(1, Number(params.pagina) || 1)
  const activity = (ACTIVITY_FILTERS.some((a) => a.value === params.actividad) ? params.actividad : "todos") as ActivityFilter
  const role = (ROLE_FILTERS.some((r) => r.value === params.rol) ? params.rol : "todos") as RoleFilter
  // ?para=<id> deja a esa persona elegida en "Correo a personas específicas".
  const para = typeof params.para === "string" ? params.para.slice(0, 40) : ""
  const [stats, users, errors, coupons, planCounts, audience, campaigns, directTo, mpAccount, subCounts] = await Promise.all([
    getAdminStats(),
    listAdminUsers({ q: q || undefined, page, activity, role }),
    getRecentErrors(),
    listCoupons(),
    getPlanCounts(),
    getAudienceCounts(),
    listCampaigns(),
    para
      ? db.user.findMany({ where: { id: para }, select: { id: true, name: true, email: true, marketingOptIn: true } })
      : Promise.resolve([]),
    mercadoPagoAccount(),
    db.subscription.groupBy({ by: ["status"], _count: true }),
  ])
  const [roleCounts, adoption, origins, unverified] = await Promise.all([countUsersByRole(), getFeatureAdoption(), getOriginStats(), countUnverified()])
  const usage = await getBusinessActivity([...new Set(users.rows.flatMap((u) => (u.memberships[0] ? [u.memberships[0].business.id] : [])))])
  const clp = (n: number) => formatMoney(n, "CLP")
  const subsBy = (status: string) => subCounts.find((c) => c.status === status)?._count ?? 0
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

  const pageHref = (p: number) =>
    `/admin?${new URLSearchParams({ ...(q ? { q } : {}), ...(activity !== "todos" ? { actividad: activity } : {}), ...(role !== "todos" ? { rol: role } : {}), pagina: String(p) })}`
  const filterHref = (a: ActivityFilter, r: RoleFilter) =>
    `/admin?${new URLSearchParams({ ...(q ? { q } : {}), ...(a !== "todos" ? { actividad: a } : {}), ...(r !== "todos" ? { rol: r } : {}) })}#usuarios`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de administración"
        description="Cuentas, negocios y uso de OrdenSimple. Solo los administradores pueden ver esta página."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard compactOnMobile label="Entraron hoy" value={formatNumber(stats.usedToday)} icon={MonitorSmartphone} tone="sales"
          hint={`${stats.used7} ${stats.used7 === 1 ? "persona" : "personas"} en 7 días · ${stats.used30} en 30 días`} />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-4 text-primary" />
            De dónde llegan
          </CardTitle>
          <CardDescription>
            Personas que se registraron en los últimos 90 días, según el enlace del anuncio por el que entraron, y cuántas avanzaron.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {origins.length ? (
            <div className="-mx-2 overflow-x-auto px-2">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Origen</th>
                    <th className="py-2 pr-3 text-right font-medium">Se registraron</th>
                    <th className="py-2 pr-3 text-right font-medium">Crearon su negocio</th>
                    <th className="py-2 pr-3 text-right font-medium">Vendieron</th>
                    <th className="py-2 text-right font-medium">Pagan</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {origins.map((o) => (
                    <tr key={`${o.source}|${o.campaign}`} className="border-b last:border-0">
                      <td className="py-2 pr-3 capitalize">{originLabel({ signupSource: o.source === "Directo / sin dato" ? null : o.source, signupCampaign: o.campaign })}</td>
                      <td className="py-2 pr-3 text-right font-medium">{formatNumber(o.users)}</td>
                      <td className="py-2 pr-3 text-right">{formatNumber(o.business)}</td>
                      <td className="py-2 pr-3 text-right">{formatNumber(o.selling)}</td>
                      <td className={cn("py-2 text-right", o.paying > 0 && "font-semibold text-success")}>{formatNumber(o.paying)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay registros en los últimos 90 días.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Para que cada anuncio aparezca aquí, usa enlaces como <code className="rounded bg-muted px-1">ordensimple.cl/?utm_source=instagram&amp;utm_campaign=escanear</code>.
            Sin enlace propio, se usa la página de donde vino (Instagram, Facebook, Google…) o queda como «Directo».
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            Funciones más usadas
          </CardTitle>
          <CardDescription>
            Cuántos de tus {formatNumber(adoption.total)} negocios usaron cada función en los últimos 30 días. Te dice qué vale la pena
            mejorar y qué casi nadie usa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {adoption.rows.map((r) => {
            const pct = adoption.total ? r.count / adoption.total : 0
            return (
              <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[16rem_minmax(0,1fr)_5.5rem]">
                <span className="truncate">
                  {r.label}
                  {"note" in r && r.note ? <span className="text-xs text-muted-foreground"> ({r.note})</span> : null}
                </span>
                <span className="tabular text-right text-muted-foreground sm:order-last">
                  {formatNumber(r.count)} · {Math.round(pct * 100)}%
                </span>
                <div className="col-span-2 h-2 overflow-hidden rounded-full bg-muted sm:col-span-1">
                  <div className={cn("h-full rounded-full", "tracked" in r ? "bg-chart-2" : "bg-chart-1")} style={{ width: `${Math.max(pct * 100, r.count ? 2 : 0)}%` }} />
                </div>
              </div>
            )
          })}
          <p className="pt-2 text-xs text-muted-foreground">
            En verde, lo que sale de los datos de cada negocio. En la otra barra, el uso de pantallas y del escáner
            {adoption.trackedSince ? `, que se mide desde el ${formatDate(new Date(adoption.trackedSince + "T12:00:00"), TZ, { day: "numeric", month: "long" })}` : ", que se empieza a medir desde hoy"}.
          </p>
        </CardContent>
      </Card>

      <section id="usuarios" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">
            Usuarios <span className="font-normal text-muted-foreground">({formatNumber(users.total)})</span>
          </h2>
          <form className="flex gap-2" action="/admin">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={q} placeholder="Buscar por nombre o correo" className="h-9 w-64 pl-9" />
            </div>
            {activity !== "todos" ? <input type="hidden" name="actividad" value={activity} /> : null}
            {role !== "todos" ? <input type="hidden" name="rol" value={role} /> : null}
            <Button type="submit" variant="outline" size="lg">Buscar</Button>
            <Button variant="outline" size="lg" asChild>
              <a
                href={`/admin/usuarios/exportar?${new URLSearchParams({ ...(q ? { q } : {}), ...(activity !== "todos" ? { actividad: activity } : {}), ...(role !== "todos" ? { rol: role } : {}) })}`}
                download
              >
                <Download />
                Excel
              </a>
            </Button>
          </form>
        </div>
        <div className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Actividad</p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_FILTERS.map((a) => (
              <Button key={a.value} variant={activity === a.value ? "default" : "outline"} size="sm" className="rounded-full" asChild>
                <Link href={filterHref(a.value, role)} aria-current={activity === a.value ? "true" : undefined}>
                  {a.label}
                </Link>
              </Button>
            ))}
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase">Rol</p>
          <div className="flex flex-wrap gap-2">
            {ROLE_FILTERS.map((r) => {
              const on = role === r.value
              return (
                <Button key={r.value} variant={on ? "default" : "outline"} size="sm" className="rounded-full" asChild>
                  <Link href={filterHref(activity, r.value)} aria-current={on ? "true" : undefined}>
                    {r.label}
                    {r.value !== "todos" ? (
                      <span className={cn("tabular rounded-full px-1.5 text-xs", on ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>
                        {formatNumber(roleCounts[r.value])}
                      </span>
                    ) : null}
                  </Link>
                </Button>
              )
            })}
          </div>
        </div>

        {users.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No se encontraron usuarios.</p>
        ) : (
          <div className="grid gap-2">
            {users.rows.map((u) => {
              const m = u.memberships[0]
              const b = m?.business
              const seen = lastSeen(u, now)
              const act = b ? usage.get(b.id) : undefined
              const lastSaleDays = act?.lastSaleAt ? (now.getTime() - act.lastSaleAt.getTime()) / 86_400_000 : null
              return (
                <div key={u.id} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1.3fr_1.5fr_1fr_auto] md:items-center">
                  <div className="min-w-0">
                    <Link href={`/admin/usuarios/${u.id}`} className="block truncate font-medium hover:text-primary hover:underline">
                      {u.name}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                    {u._count.adminNotes ? (
                      <Link href={`/admin/usuarios/${u.id}#notas`} className="mt-1 inline-flex items-center gap-1 text-xs text-warning hover:underline">
                        <NotebookPen className="size-3.5" />
                        {u._count.adminNotes} {u._count.adminNotes === 1 ? "nota" : "notas"}
                      </Link>
                    ) : null}
                  </div>
                  <div className="min-w-0 text-sm">
                    {b ? (
                      <>
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate">{b.name}</span>
                          <Badge variant={effectivePlan(b, now) === "FREE" ? "secondary" : "default"}>
                            {PLANS[effectivePlan(b, now)].name}
                          </Badge>
                          <Badge variant="outline" className={m.role === "OWNER" ? "border-primary/40 text-primary" : m.role === "ADMIN" ? "border-warning/40" : undefined}>
                            {ROLE_LABEL[m.role]}
                          </Badge>
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
                        {b.extraProducts || b.extraMembers ? (
                          <p className="text-xs text-muted-foreground">
                            Cupos extra:{" "}
                            {[b.extraProducts ? `+${b.extraProducts} productos` : null, b.extraMembers ? `+${b.extraMembers} trabajadores` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {b.type ?? "Sin rubro"} · {formatNumber(b._count.sales)} ventas · {formatNumber(b._count.expenses)} gastos ·{" "}
                          {formatNumber(b._count.products)} productos · {formatNumber(b._count.members)} {b._count.members === 1 ? "persona" : "personas"}
                        </p>
                        {act?.lastSaleAt ? (
                          <p className="text-xs text-muted-foreground" title={formatDateTime(act.lastSaleAt, TZ)}>
                            Última venta: <span className="text-foreground">{ago(act.lastSaleAt, now)}</span>
                            {act.sales30
                              ? ` · 30 días: ${formatNumber(act.sales30)} ventas por ${clp(act.total30)}, en ${act.days30} ${act.days30 === 1 ? "día" : "días"} distintos`
                              : " · sin ventas en 30 días"}
                          </p>
                        ) : null}
                        {act?.bestProduct ? (
                          <p className="truncate text-xs text-muted-foreground">
                            Producto estrella (90 días): <span className="text-foreground">{act.bestProduct.name}</span> ·{" "}
                            {formatNumber(act.bestProduct.qty)} u. · {clp(act.bestProduct.revenue)}
                          </p>
                        ) : null}
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
                    <p className="capitalize">Llegó por: {originLabel(u)}</p>
                    <p title={seen?.title}>
                      Última vez activo:{" "}
                      <span className={seen && seen.days < 1 ? "font-medium text-success" : seen && seen.days > 14 ? "text-warning" : "text-foreground"}>
                        {seen?.label ?? "nunca"}
                      </span>
                    </p>
                    {device(u.sessions[0]?.userAgent) ? <p>Desde: {device(u.sessions[0]?.userAgent)}</p> : null}
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
                    {b && m.role === "OWNER" ? (
                      <ExtrasDialog
                        businessId={b.id}
                        businessName={b.name}
                        planName={PLANS[effectivePlan(b, now)].name}
                        baseProducts={PLANS[effectivePlan(b, now)].maxProducts}
                        baseMembers={PLANS[effectivePlan(b, now)].maxMembers - 1}
                        extraProducts={b.extraProducts}
                        extraMembers={b.extraMembers}
                      />
                    ) : null}
                    {lastSaleDays !== null && lastSaleDays <= 7 ? (
                      <Badge className="bg-success/15 text-success">Usando la app</Badge>
                    ) : lastSaleDays !== null ? (
                      <Badge variant="outline" className="border-warning/40 text-warning">
                        Sin vender hace {Math.floor(lastSaleDays)} días
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Sin ventas aún
                      </Badge>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin?para=${u.id}#correo-directo`} aria-label={`Escribirle a ${u.name}`}>
                        <Mail />
                        Escribirle
                      </Link>
                    </Button>
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

      <section id="cobros" className="scroll-mt-20 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Crown className="size-5 text-muted-foreground" />
          Cobros (Mercado Pago)
        </h2>
        <div className="grid gap-2 rounded-xl border bg-card p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Cuenta conectada</p>
            {mpAccount.ok ? (
              mpAccount.test ? (
                <p className="font-medium text-danger">⚠ Es una cuenta de PRUEBA: no cobra plata real</p>
              ) : (
                <p className="font-medium text-success">✓ Cuenta real{mpAccount.site === "MLC" ? " de Chile" : ` (${mpAccount.site})`}</p>
              )
            ) : (
              <p className="font-medium text-danger">✗ {mpAccount.reason}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cobro</p>
            <p className="font-medium">
              {BILLING_ENABLED ? "Encendido" : "Apagado (lanzamiento)"}
              {PLANS_ENFORCED ? " · límites del plan Gratis activos" : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Suscripciones</p>
            <p className="font-medium">
              {formatNumber(subsBy("authorized"))} activas · {formatNumber(subsBy("pending"))} pendientes · {formatNumber(subsBy("cancelled"))} canceladas
            </p>
          </div>
        </div>
      </section>

      <Card id="confirmar-correos">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="size-4 text-primary" />
            Confirmación de correos
          </CardTitle>
          <CardDescription>
            Confirmar el correo sirve para recuperar la cuenta si olvidan la contraseña. Los avisos y promociones les llegan igual. Las
            cuentas nuevas reciben el enlace al registrarse; aquí se lo mandas a las que ya existían.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-muted/50 px-4 py-2">
              <p className="tabular text-xl font-semibold">{formatNumber(unverified.total)}</p>
              <p className="text-xs text-muted-foreground">sin confirmar</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-4 py-2">
              <p className="tabular text-xl font-semibold">{formatNumber(unverified.pending)}</p>
              <p className="text-xs text-muted-foreground">sin enlace enviado</p>
            </div>
          </div>
          <div className="space-y-1 text-right">
            <VerifyLinksButton pending={unverified.pending} />
            <p className="text-xs text-muted-foreground">Máximo 80 por vez, para no pasar tu límite diario de correos.</p>
          </div>
        </CardContent>
      </Card>

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
        <div className="space-y-1 pt-2">
          <h3 className="font-semibold">Correo a personas específicas</h3>
          <p className="text-sm text-muted-foreground">
            Para responderle a alguien, avisarle algo de su cuenta o enviarle una oferta solo a algunos.
          </p>
        </div>
        <DirectEmailComposer key={para || "nadie"} appUrl={getAppUrl()} initial={directTo} />
        {campaigns.length ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Enviados</h3>
            <ul className="grid gap-2">
              {campaigns.map((cm) => (
                <li key={cm.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{cm.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {cm.audience === "DIRECT" ? `Para: ${shortList(cm.toEmails, cm.recipients)}` : (AUDIENCES[cm.audience as Audience] ?? cm.audience)}
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
