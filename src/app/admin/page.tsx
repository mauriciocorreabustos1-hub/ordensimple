import Link from "next/link"
import { Activity, BarChart3, Building2, Search, ShoppingBag, UserPlus, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/app/stat-card"
import { formatNumber } from "@/lib/currency"
import { formatDate, formatDateTime } from "@/lib/dates"
import { PLANS } from "@/lib/plans"
import { ROLE_LABEL } from "@/lib/roles"
import { getAdminStats, listAdminUsers, type AdminUserRow } from "@/server/queries/admin"

const TZ = "America/Santiago"

function lastSeen(u: AdminUserRow) {
  const at = u.sessions[0]?.updatedAt
  return at ? formatDateTime(at, TZ) : "—"
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : ""
  const page = Math.max(1, Number(params.pagina) || 1)
  const [stats, users] = await Promise.all([getAdminStats(), listAdminUsers({ q: q || undefined, page })])
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
                <div key={u.id} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1.4fr_1.4fr_1fr_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="min-w-0 text-sm">
                    {b ? (
                      <>
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate">{b.name}</span>
                          <Badge variant="secondary">{PLANS[b.plan].name}</Badge>
                          {m.role !== "OWNER" ? <Badge variant="outline">{ROLE_LABEL[m.role]}</Badge> : null}
                        </p>
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
                  <div className="flex md:justify-end">
                    {b?._count.sales ? (
                      <Badge className="bg-success/15 text-success">Usando la app</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Sin ventas aún
                      </Badge>
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

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <BarChart3 className="size-3.5" />
        Las visitas a la página (personas, países, dispositivos) se ven en Vercel → tu proyecto → Analytics.
      </p>
    </div>
  )
}
