import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, Crown, Mail, MonitorSmartphone, NotebookPen, ShoppingBag, Sparkles, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminNotes } from "@/components/admin/admin-notes"
import { ExtrasDialog } from "@/components/admin/extras-dialog"
import { PlanDialog } from "@/components/admin/plan-dialog"
import { StatCard } from "@/components/app/stat-card"
import { ago, device } from "@/lib/activity-format"
import { originLabel } from "@/lib/signup-source"
import { formatMoney, formatNumber } from "@/lib/currency"
import { formatDate, formatDateTime } from "@/lib/dates"
import { effectivePlan, PLANS } from "@/lib/plans"
import { ROLE_LABEL } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { TRACKED_FEATURES } from "@/server/feature-usage"
import { getAdminUserDetail } from "@/server/queries/admin-detail"

export const metadata: Metadata = { title: "Ficha de usuario" }

const TZ = "America/Santiago"
const SUB_STATUS: Record<string, string> = { authorized: "Activa", pending: "Pendiente de pago", paused: "Pausada", cancelled: "Cancelada" }

export default async function AdminUserPage({ params, searchParams }: PageProps<"/admin/usuarios/[id]">) {
  const { id } = await params
  const sp = await searchParams
  const detail = await getAdminUserDetail(id, typeof sp.negocio === "string" ? sp.negocio : undefined)
  if (!detail) notFound()
  const { user: u, membership: m, activity: a } = detail
  const b = m?.business
  const now = new Date()
  const clp = (n: number) => formatMoney(n, b?.currency ?? "CLP")
  const longDate = (d: Date) => formatDate(d, TZ, { day: "numeric", month: "long", year: "numeric" })
  const seenAt = u.lastActiveAt ?? u.sessions[0]?.updatedAt ?? null
  const plan = b ? effectivePlan(b, now) : null
  const maxDay = Math.max(1, ...(a?.last30.map((d) => d.sales) ?? [0]))
  const maxWeek = Math.max(1, ...(a?.weeks.map((w) => w.total) ?? [0]))

  return (
    <div className="space-y-6">
      <Link href="/admin#usuarios" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Volver a usuarios
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{u.name}</h1>
          <p className="text-muted-foreground">{u.email}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {u.memberships.map((x) => (
              <Badge key={x.business.id} variant="outline">
                {ROLE_LABEL[x.role]} · {x.business.name}
              </Badge>
            ))}
            {u.marketingOptIn ? <Badge variant="secondary">Acepta promociones</Badge> : null}
            {!u.emailVerified ? <Badge variant="outline" className="text-warning">Correo sin verificar</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin?para=${u.id}#correo-directo`}>
              <Mail />
              Escribirle
            </Link>
          </Button>
          {b && m?.role === "OWNER" && plan ? (
            <>
              <PlanDialog businessId={b.id} businessName={b.name} currentPlan={plan} expiresLabel={b.planExpiresAt && b.planExpiresAt > now ? longDate(b.planExpiresAt) : null} />
              <ExtrasDialog
                businessId={b.id}
                businessName={b.name}
                planName={PLANS[plan].name}
                baseProducts={PLANS[plan].maxProducts}
                baseMembers={PLANS[plan].maxMembers - 1}
                extraProducts={b.extraProducts}
                extraMembers={b.extraMembers}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard compactOnMobile label="Última vez activo" value={seenAt ? ago(seenAt, now) : "Nunca"} icon={MonitorSmartphone} tone="sales"
          hint={[seenAt ? formatDateTime(seenAt, TZ) : null, device(u.sessions[0]?.userAgent)].filter(Boolean).join(" · ") || undefined} />
        <StatCard compactOnMobile label="Se registró" value={formatDate(u.createdAt, TZ, { day: "numeric", month: "short", year: "numeric" })} icon={CalendarDays}
          hint={`${ago(u.createdAt, now)} · llegó por ${originLabel(u)}${u.signupMedium ? ` (${u.signupMedium})` : ""}${u.signupReferrer ? ` · desde ${u.signupReferrer}` : ""}`} />
        <StatCard compactOnMobile label="Plan" value={plan ? PLANS[plan].name : "Sin negocio"} icon={Crown} tone="profit"
          hint={b && b.plan !== "FREE" && b.planExpiresAt ? (b.planExpiresAt > now ? `Hasta el ${longDate(b.planExpiresAt)}` : `Venció el ${longDate(b.planExpiresAt)}`) : undefined} />
        <StatCard compactOnMobile label="Ventas (30 días)" value={a ? clp(a.total30) : "—"} icon={ShoppingBag}
          hint={a ? `${formatNumber(a.sales30)} ventas · activo ${a.activeDays30} de 30 días` : undefined} />
      </div>

      {u.memberships.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {u.memberships.map((x) => (
            <Button key={x.business.id} variant={x.business.id === b?.id ? "default" : "outline"} size="sm" className="rounded-full" asChild>
              <Link href={`/admin/usuarios/${u.id}?negocio=${x.business.id}`}>{x.business.name}</Link>
            </Button>
          ))}
        </div>
      ) : null}

      {b && a ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Actividad día a día</CardTitle>
              <CardDescription>Últimos 30 días. Cada cuadro es un día: más oscuro, más ventas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-10 gap-1.5">
                {a.last30.map((d) => (
                  <div
                    key={d.key}
                    title={`${d.label}: ${d.sales} ventas (${clp(d.total)}), ${d.expenses} gastos`}
                    className={cn("aspect-square rounded-md border", !d.sales && !d.expenses && "bg-muted/40")}
                    style={d.sales || d.expenses ? { background: `color-mix(in oklab, var(--primary) ${Math.round(15 + (d.sales / maxDay) * 85)}%, transparent)` } : undefined}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Usó la app {a.activeDays30} de los últimos 30 días.{" "}
                {a.lastSaleAt ? `Última venta: ${ago(a.lastSaleAt, now)} (${formatDateTime(a.lastSaleAt, TZ)}).` : "Aún no registra ventas."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ventas por semana</CardTitle>
              <CardDescription>Últimas 12 semanas.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Ventas por semana en las últimas 12 semanas">
                {a.weeks.map((w) => (
                  <div key={w.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Semana del ${w.label}: ${w.sales} ventas · ${clp(w.total)}`}>
                    <div
                      className="w-full max-w-7 rounded-t bg-chart-1"
                      style={{ height: `${w.total ? Math.max(4, (w.total / maxWeek) * 100) : 2}%`, opacity: w.total ? 1 : 0.25 }}
                    />
                    <span className="text-[10px] text-muted-foreground">{w.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="size-4 text-warning" />
                Su negocio
              </CardTitle>
              <CardDescription>
                {b.name} · {b.type ?? "Sin rubro"} · creado {formatDate(b.createdAt, TZ, { day: "numeric", month: "short", year: "numeric" })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ["Ventas", b._count.sales],
                  ["Gastos", b._count.expenses],
                  ["Productos", b._count.products],
                  ["Clientes", b._count.customers],
                  ["Personas", b._count.members],
                ].map(([label, n]) => (
                  <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="tabular text-lg font-semibold">{formatNumber(n as number)}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-1.5 font-medium">Lo que más vende (90 días)</p>
                {a.top.length ? (
                  <ol className="space-y-1">
                    {a.top.map((t, i) => (
                      <li key={t.name} className="flex justify-between gap-3">
                        <span className="truncate">
                          {i + 1}. {t.name}
                        </span>
                        <span className="tabular shrink-0 text-muted-foreground">
                          {formatNumber(t.qty)} u. · {clp(t.revenue)}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted-foreground">Sin ventas con productos (solo ventas rápidas o ninguna).</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 font-medium">
                  <Sparkles className="size-4 text-primary" />
                  Funciones que usó (30 días)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(TRACKED_FEATURES).map(([key, label]) => {
                    const used = a.features.find((f) => f.feature === key)?.count ?? 0
                    return (
                      <Badge key={key} variant={used ? "default" : "outline"} className={used ? undefined : "text-muted-foreground"}>
                        {label}
                        {used ? ` · ${used}` : ""}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="size-4 text-warning" />
                Plan y pagos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Plan actual: <strong>{plan ? PLANS[plan].name : "—"}</strong>
                {b.plan !== "FREE" && b.planExpiresAt ? ` · ${b.planExpiresAt > now ? "hasta" : "venció"} el ${longDate(b.planExpiresAt)}` : ""}
                {b.discountPercent ? ` · descuento guardado ${b.discountPercent}%` : ""}
                {b.extraProducts || b.extraMembers ? ` · cupos extra: +${b.extraProducts} productos, +${b.extraMembers} trabajadores` : ""}
              </p>
              {b.subscriptions.length ? (
                <ul className="divide-y rounded-xl border px-3">
                  {b.subscriptions.map((s) => (
                    <li key={s.id} className="space-y-0.5 py-2.5">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{PLANS[s.plan].name}</span>
                        <Badge variant={s.status === "authorized" ? "default" : "outline"}>{SUB_STATUS[s.status] ?? s.status}</Badge>
                        <span className="tabular text-muted-foreground">{clp(s.amount)}/mes</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Desde {formatDate(s.createdAt, TZ, { day: "numeric", month: "short", year: "numeric" })} · paga {s.payerEmail}
                        {s.lastChargedAt ? ` · último cobro ${formatDate(s.lastChargedAt, TZ, { day: "numeric", month: "short" })}` : " · aún sin cobros"}
                        {s.nextPaymentAt && s.status === "authorized" ? ` · próximo ${formatDate(s.nextPaymentAt, TZ, { day: "numeric", month: "short" })}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Nunca ha contratado una suscripción.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Esta persona no terminó de crear su negocio, así que todavía no hay actividad.
        </p>
      )}

      <Card id="notas">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NotebookPen className="size-4 text-warning" />
            Notas internas
          </CardTitle>
          <CardDescription>Solo las ven los administradores. Anota llamadas, pedidos o lo que te dijo.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminNotes
            userId={u.id}
            notes={u.adminNotes.map((n) => ({ id: n.id, text: n.text, author: n.author, when: formatDateTime(n.createdAt, TZ) }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
