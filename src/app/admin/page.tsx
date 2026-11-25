import Link from "next/link"
import { BarChart3, BellRing, Download, Gift, Link2, MailCheck, Megaphone, NotebookPen, Bug, CheckCircle2, Crown, Mail, Search, TicketPercent, ShieldCheck } from "lucide-react"
import { AdminShell } from "@/components/admin/admin-shell"
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
import { getAppUrl } from "@/lib/app-url"
import { formatMoney, formatNumber } from "@/lib/currency"
import { formatDate, formatDateTime } from "@/lib/dates"
import { couponSummary, effectivePlan, PLANS } from "@/lib/plans"
import { ROLE_LABEL } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { ago, device } from "@/lib/activity-format"
import { adminEmailSet, isAdminEmail, listAdmins, requireAdmin } from "@/server/admin"
import { AdminsManager, type AdminRow } from "@/components/admin/admins-manager"
import { getFeatureAdoption, getOriginStats } from "@/server/queries/admin-detail"
import { countUnverified } from "@/server/verify-reminders"
import { VerifyLinksButton } from "@/components/admin/verify-links-button"
import { ReferralSettings } from "@/components/admin/referral-settings"
import { getReferralAdmin, getSpecialLinksAdmin } from "@/server/referrals"
import { SpecialLinks, type SpecialLinkRow } from "@/components/admin/special-links"
import { originLabel } from "@/lib/signup-source"
import { LicenseManager, type LicenseAdminData, type LicenseCodeRow } from "@/components/admin/license-manager"
import { getLicenseAdmin, LICENSE_FILTERS, type LicenseFilter } from "@/server/queries/licenses"
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
import { EXPIRED_COOLDOWN_DAYS, listExpiredPlans } from "@/server/queries/expired-plans"
import { ExpiredPlans, type ExpiredRow } from "@/components/admin/expired-plans"
import { getReminderSegments, REMINDER_SEGMENT_KEYS, REMINDER_SEGMENTS, type ReminderSegment } from "@/server/queries/sales-reminders"
import { RemindUserButton, SalesReminders, type SegmentCard } from "@/components/admin/sales-reminders"

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
  // Sección Códigos (Pro permanente): filtro por estado, búsqueda y aviso de la conexión con Mercado Libre.
  const licenseFilter = (LICENSE_FILTERS.some((f) => f.value === params.codigos) ? params.codigos : "todos") as LicenseFilter
  const licenseQ = typeof params.codigo === "string" ? params.codigo.trim().slice(0, 60) : ""
  const mlFlash = typeof params.ml === "string" ? params.ml.slice(0, 20) : null
  // Desde "Qué revisar": abre el correo a los planes vencidos (recordatorio u oferta) con todos los elegibles marcados.
  const expiredOpen = params.vencidos === "aviso" || params.vencidos === "oferta" ? params.vencidos : null
  // Desde "Qué revisar": abre el recordatorio para anotar ventas de ese grupo.
  const reminderOpen = (REMINDER_SEGMENT_KEYS as string[]).includes(String(params.recordar)) ? (params.recordar as ReminderSegment) : null
  const me = await requireAdmin()
  const [adminEmails, admins] = await Promise.all([adminEmailSet(), listAdmins()])
  const adminRows: AdminRow[] = admins.map((a) => ({
    email: a.email,
    owner: a.owner,
    name: a.user?.name ?? null,
    verified: a.user ? a.user.emailVerified : null,
    twoFactor: a.user ? a.user.twoFactorEnabled : null,
  }))
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
  const [roleCounts, adoption, origins, unverified, referrals] = await Promise.all([
    countUsersByRole(),
    getFeatureAdoption(),
    getOriginStats(),
    countUnverified(),
    getReferralAdmin(),
  ])
  const [specialLinks, expired, reminders] = await Promise.all([getSpecialLinksAdmin(), listExpiredPlans(), getReminderSegments()])
  const reminderCards: SegmentCard[] = REMINDER_SEGMENT_KEYS.map((key) => ({
    key,
    label: REMINDER_SEGMENTS[key].label,
    hint: REMINDER_SEGMENTS[key].hint,
    count: reminders[key].people.length,
    sample: reminders[key].people.slice(0, 3).map((x) => x.name),
    skipped: reminders[key].skipped,
  }))
  const lic = await getLicenseAdmin({ filter: licenseFilter, q: licenseQ })
  const when = (d: Date | null) => (d ? formatDateTime(d, TZ) : null)
  const licenseRow = (c: (typeof lic.codes)[number]): LicenseCodeRow => ({
    id: c.id,
    code: c.code,
    status: c.status,
    note: c.note,
    createdLabel: formatDateTime(c.createdAt, TZ),
    sentLabel: when(c.sentAt),
    redeemedLabel: when(c.redeemedAt),
    voidedLabel: when(c.voidedAt),
    redeemedByEmail: c.redeemedByEmail,
    mlOrderId: c.mlOrderId,
    mlUnit: c.mlUnit,
    lastError: c.lastError,
    sendAttempts: c.sendAttempts,
  })
  const licenseData: LicenseAdminData = {
    counts: lic.counts,
    filter: licenseFilter,
    q: licenseQ,
    matching: lic.matching,
    codes: lic.codes.map(licenseRow),
    review: lic.review.map((o) => ({ id: o.id, reason: o.reviewReason ?? "", buyerNick: o.buyerNick, updatedLabel: formatDateTime(o.updatedAt, TZ), codes: o.codes.map((c) => ({ id: c.id, code: c.code, status: c.status })) })),
    waiting: lic.waiting.map((o) => ({ id: o.id, pendingUnits: o.pendingUnits, buyerNick: o.buyerNick })),
    unsent: lic.unsent.map(licenseRow),
    logs: lic.logs.map((l) => ({ id: l.id, kind: l.kind, detail: l.detail, at: formatDateTime(l.createdAt, TZ) })),
    ml: {
      configured: lic.ml.configured,
      items: lic.ml.items,
      account: lic.ml.account ? { name: lic.ml.account.nickname ?? `vendedor ${lic.ml.account.sellerId}`, connectedBy: lic.ml.account.connectedBy, updatedLabel: ago(lic.ml.account.updatedAt, new Date()) } : null,
      failure: lic.ml.lastFailure?.detail ?? null,
      notifyUrl: `${getAppUrl().startsWith("https://") ? getAppUrl() : "https://www.ordensimple.cl"}/api/mercadolibre/notificaciones`,
    },
    flash: mlFlash,
  }
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
  const specialRows: SpecialLinkRow[] = specialLinks.map((l) => ({
    id: l.id,
    name: l.name,
    code: l.code,
    url: `${getAppUrl()}/amigo/${l.code}`,
    gift: `${l.days} días gratis del plan ${PLANS[l.plan].name}`,
    expiresLabel: l.expiresAt ? longDate(l.expiresAt) : null,
    expired: Boolean(l.expiresAt && l.expiresAt <= now),
    maxUses: l.maxUses,
    active: l.active,
    signups: l.signups,
    businesses: l.businesses,
    paying: l.paying,
  }))
  const maxSignups = Math.max(1, ...stats.signupsByDay.map((d) => d.count))
  const expiredRows: ExpiredRow[] = expired.map((e) => {
    const days = Math.floor((now.getTime() - e.expiredAt.getTime()) / 86_400_000)
    const saleDays = e.lastSaleAt ? (now.getTime() - e.lastSaleAt.getTime()) / 86_400_000 : null
    return {
      id: e.id,
      name: e.name,
      planName: PLANS[e.plan].name,
      expiredLabel: longDate(e.expiredAt),
      expiredAgo: ago(e.expiredAt, now),
      expiredDays: days,
      owner: e.owner ? { id: e.owner.id, name: e.owner.name, email: e.owner.email, optIn: e.owner.marketingOptIn } : null,
      activity: e.lastSaleAt ? `Última venta ${ago(e.lastSaleAt, now)}` : e.sales ? "Sin ventas recientes" : "Nunca registró ventas",
      active: saleDays !== null && saleDays <= 14,
      lastNotice: e.lastNotice ? { label: ago(e.lastNotice.at, now), kind: e.lastNotice.kind, coupon: e.lastNotice.coupon } : null,
      cooling: Boolean(e.lastNotice && now.getTime() - e.lastNotice.at.getTime() < EXPIRED_COOLDOWN_DAYS * 86_400_000),
    }
  })
  const expiredSelling = expiredRows.filter((r) => r.active).length
  const activeCoupons = coupons.filter((cp) => cp.active && !(cp.expiresAt && cp.expiresAt <= now)).map((cp) => ({ code: cp.code, summary: couponSummary(cp) }))

  const pageHref = (p: number) =>
    `/admin?${new URLSearchParams({ ...(q ? { q } : {}), ...(activity !== "todos" ? { actividad: activity } : {}), ...(role !== "todos" ? { rol: role } : {}), pagina: String(p) })}#usuarios`
  const filterHref = (a: ActivityFilter, r: RoleFilter) =>
    `/admin?${new URLSearchParams({ ...(q ? { q } : {}), ...(a !== "todos" ? { actividad: a } : {}), ...(r !== "todos" ? { rol: r } : {}) })}#usuarios`

  // Lo que conviene mirar primero, arriba del panel.
  const alerts: { href: string; tone: "danger" | "warning"; text: string; hint?: string; actions?: { href: string; label: string }[] }[] = []
  if (errors.last24)
    alerts.push({ href: "#errores", tone: "danger", text: `${formatNumber(errors.last24)} ${errors.last24 === 1 ? "error" : "errores"} en las últimas 24 horas` })
  if (!mpAccount.ok) alerts.push({ href: "#cobros", tone: "danger", text: `Mercado Pago no está conectado: ${mpAccount.reason}` })
  else if (mpAccount.test) alerts.push({ href: "#cobros", tone: "danger", text: "Mercado Pago tiene una cuenta de prueba: no cobra dinero real" })
  if (unverified.pending)
    alerts.push({
      href: "#confirmar-correos",
      tone: "warning",
      text: `${formatNumber(unverified.pending)} ${unverified.pending === 1 ? "cuenta" : "cuentas"} sin el enlace para confirmar su correo`,
    })
  if (lic.ml.lastFailure) alerts.push({ href: "#licencias", tone: "danger", text: "Mercado Libre no responde: las ventas pueden quedar sin código" })
  const licenseAttention = lic.review.length + lic.waiting.length + lic.unsent.length
  if (licenseAttention)
    alerts.push({ href: "#licencias", tone: "danger", text: `${formatNumber(licenseAttention)} ${licenseAttention === 1 ? "venta o código" : "ventas o códigos"} del Pro permanente para revisar` })
  else if (lic.counts.available < 5)
    alerts.push({ href: "#licencias", tone: "warning", text: lic.counts.available ? `Quedan ${lic.counts.available} códigos del Pro permanente` : "No quedan códigos del Pro permanente" })
  if (reminders.primera.people.length)
    alerts.push({
      href: "#recordar-ventas",
      tone: "warning",
      text: `${formatNumber(reminders.primera.people.length)} ${reminders.primera.people.length === 1 ? "negocio nunca anotó una venta" : "negocios nunca anotaron una venta"}`,
      hint: "Un recordatorio con el botón que abre Registrar venta suele bastar para que partan",
      actions: [{ href: "/admin?recordar=primera#recordar-ventas", label: "Recordar" }],
    })
  if (planCounts.expired)
    alerts.push({
      href: "#vencidos",
      tone: "warning",
      text: `${formatNumber(planCounts.expired)} ${planCounts.expired === 1 ? "plan vencido" : "planes vencidos"}`,
      hint: expiredSelling ? `${formatNumber(expiredSelling)} siguen vendiendo: son los más fáciles de recuperar` : "Recuérdales o regálales unos días para que vuelvan",
      actions: [
        { href: "/admin?vencidos=aviso#vencidos", label: "Recordar" },
        { href: "/admin?vencidos=oferta#vencidos", label: "Ofrecer descuento" },
      ],
    })


  const signups14 = stats.signupsByDay.reduce((n, d) => n + d.count, 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Panel de administración" description="Cuentas, negocios y uso de OrdenSimple. Solo los administradores pueden ver esta página." />

      <AdminShell
        sections={[
          {
            id: "resumen",
            label: "Resumen",
            title: "Cómo va OrdenSimple",
            description: "El cierre de hoy: quiénes entraron, cuántos negocios venden y lo que conviene revisar.",
            count: alerts.length || undefined,
            tone: "danger",
            content: (
              <div key="resumen" className="grid gap-8 xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:gap-10">
                <div className="mx-auto w-full max-w-sm drop-shadow-[0_1px_2px_rgb(0_0_0/0.12)] xl:mx-0">
                  <div className="receipt-edge bg-[#fbfaf6] px-6 pt-6 pb-10 font-mono text-[13px] leading-6 text-[#13201c]">
                    <p className="text-center font-display text-base font-semibold tracking-tight">OrdenSimple</p>
                    <p className="text-center text-xs text-[#13201c]/60">Cierre al {formatDateTime(now, TZ)}</p>
                    <Rule />
                    <Line label="Entraron hoy" value={stats.usedToday} strong />
                    <Line label="En 7 días" value={stats.used7} />
                    <Line label="En 30 días" value={stats.used30} />
                    <Rule />
                    <Line label="Cuentas" value={stats.users} strong />
                    <Line label="Nuevas esta semana" value={stats.users7} />
                    <Line label="Negocios creados" value={stats.businesses} />
                    <Line label="Vendieron en 7 días" value={stats.active7} />
                    <Line label="Vendieron en 30 días" value={stats.active30} />
                    <Rule />
                    <Line label="Ventas anotadas" value={stats.sales} />
                    <Line label="Gastos anotados" value={stats.expenses} />
                    <Line label="Productos" value={stats.products} />
                    <Rule />
                    <Line label="Con Pro" value={planCounts.pro} />
                    <Line label="Con Empresa" value={planCounts.business} />
                    <Line label="Planes vencidos" value={planCounts.expired} />
                    <div className="mt-3 flex items-baseline justify-between border-t-2 border-double border-[#13201c]/45 pt-2">
                      <span className="font-semibold">Registros en total</span>
                      <span className="tabular font-display text-xl font-semibold">{formatNumber(stats.sales + stats.expenses)}</span>
                    </div>
                    <p className="mt-4 text-center text-xs text-[#13201c]/60">Para dar un plan, busca a la persona en Usuarios y toca Plan.</p>
                  </div>
                </div>

                <div className="min-w-0 space-y-8 max-xl:order-first">
                  <div className="space-y-3">
                    <h3 className="font-semibold">Qué revisar</h3>
                    {alerts.length ? (
                      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                        {alerts.map((a) => (
                          <li key={a.href + a.text} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
                            <span className={cn("size-2 shrink-0 rounded-full", a.tone === "danger" ? "bg-danger" : "bg-warning")} aria-hidden />
                            <a href={a.href} className="min-w-0 flex-1 hover:underline">
                              <span className="block font-medium">{a.text}</span>
                              {a.hint ? <span className="block text-xs text-muted-foreground">{a.hint}</span> : null}
                            </a>
                            <span className="flex flex-wrap gap-1.5 max-sm:w-full max-sm:pl-5">
                              {a.actions?.map((x) => (
                                <Button key={x.href} variant="outline" size="sm" asChild>
                                  <a href={x.href}>{x.label}</a>
                                </Button>
                              ))}
                              <Button variant="ghost" size="sm" asChild>
                                <a href={a.href}>Ver</a>
                              </Button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
                        <CheckCircle2 className="size-4 text-success" aria-hidden />
                        Todo en orden: sin errores en las últimas 24 horas y Mercado Pago conectado.
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold">Cuentas nuevas por día</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatNumber(signups14)} en los últimos 14 días
                      </p>
                    </div>
                    <div className="rounded-xl border px-4 pt-5 pb-3">
                      <div className="flex h-44 items-end gap-1.5 sm:gap-2" role="img" aria-label={`Cuentas nuevas por día: ${formatNumber(signups14)} en los últimos 14 días`}>
                        {stats.signupsByDay.map((d, i) => {
                          const today = i === stats.signupsByDay.length - 1
                          return (
                            <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                              <span className="tabular text-[11px] text-muted-foreground">{d.count || ""}</span>
                              <div
                                className={cn("w-full max-w-8 rounded-md", today ? "bg-primary" : "bg-primary/45")}
                                style={{ height: `${d.count ? Math.max(6, (d.count / maxSignups) * 100) : 3}%`, opacity: d.count ? 1 : 0.35 }}
                                title={`${formatDate(d.day, TZ, { day: "numeric", month: "short" })}: ${d.count}`}
                              />
                              <span className={cn("tabular text-[11px]", today ? "font-semibold text-foreground" : "text-muted-foreground")}>
                                {today ? "Hoy" : formatDate(d.day, TZ, { day: "numeric" })}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: "usuarios",
            label: "Usuarios",
            title: "Usuarios",
            description: "Busca a una persona, mira cómo usa la app, dale un plan o escríbele.",
            count: users.total,
            content: (
              <div key="usuarios" className="space-y-4">
                <form className="flex flex-wrap gap-2" action="/admin#usuarios" role="search">
                  <div className="relative w-full sm:w-auto">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input name="q" defaultValue={q} placeholder="Buscar por nombre o correo" aria-label="Buscar usuarios por nombre o correo" className="h-9 w-full pl-9 sm:w-72" />
                  </div>
                  {activity !== "todos" ? <input type="hidden" name="actividad" value={activity} /> : null}
                  {role !== "todos" ? <input type="hidden" name="rol" value={role} /> : null}
                  <Button type="submit" variant="outline" size="lg" className="max-sm:flex-1">Buscar</Button>
                  <Button variant="outline" size="lg" className="max-sm:flex-1" asChild>
                    <a
                      href={`/admin/usuarios/exportar?${new URLSearchParams({ ...(q ? { q } : {}), ...(activity !== "todos" ? { actividad: activity } : {}), ...(role !== "todos" ? { rol: role } : {}) })}`}
                      download
                    >
                      <Download />
                      Excel
                    </a>
                  </Button>
                </form>
              <div className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-4">
                <p className="text-sm font-medium text-muted-foreground">Actividad</p>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_FILTERS.map((a) => (
                    <Button key={a.value} variant={activity === a.value ? "default" : "outline"} size="sm" className="rounded-full" asChild>
                      <Link href={filterHref(a.value, role)} aria-current={activity === a.value ? "true" : undefined}>
                        {a.label}
                      </Link>
                    </Button>
                  ))}
                </div>
                <p className="text-sm font-medium text-muted-foreground">Rol</p>
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
                <div className="@container grid gap-2">
                  {users.rows.map((u) => {
                    const m = u.memberships[0]
                    const b = m?.business
                    const seen = lastSeen(u, now)
                    const act = b ? usage.get(b.id) : undefined
                    const lastSaleDays = act?.lastSaleAt ? (now.getTime() - act.lastSaleAt.getTime()) / 86_400_000 : null
                    const status =
                      lastSaleDays !== null && lastSaleDays <= 7
                        ? { label: "Usando la app", cls: "bg-success/12 text-success", dot: "bg-success" }
                        : lastSaleDays !== null
                          ? { label: `Sin vender hace ${Math.floor(lastSaleDays)} días`, cls: "bg-warning/12 text-warning", dot: "bg-warning" }
                          : { label: b ? "Sin ventas aún" : "Sin negocio", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" }
                    // Qué recordatorio le sirve: configurar el negocio, la primera venta o volver a anotar.
                    const reminderFor: ReminderSegment | null = !b
                      ? "configurar"
                      : m.role !== "OWNER"
                        ? null
                        : b._count.sales === 0
                          ? "primera"
                          : lastSaleDays !== null && lastSaleDays >= 14
                            ? "volver"
                            : null
                    const initials = u.name
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()
                    return (
                      <article key={u.id} className="overflow-hidden rounded-xl border bg-card">
                        <div className="grid gap-x-6 gap-y-3 p-4 @3xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)_auto] @3xl:items-start">
                          {/* La persona */}
                          <div className="flex min-w-0 items-start gap-3">
                            <span
                              aria-hidden
                              className={cn(
                                "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold",
                                lastSaleDays !== null && lastSaleDays <= 7 ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
                              )}
                            >
                              {initials || "?"}
                            </span>
                            <div className="min-w-0">
                              <Link href={`/admin/usuarios/${u.id}`} className="block truncate font-semibold hover:text-primary hover:underline">
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
                          </div>

                          {/* El negocio */}
                          <div className="min-w-0 space-y-1.5 text-sm">
                            {b ? (
                              <>
                                <p className="flex flex-wrap items-center gap-1.5">
                                  <span className="truncate font-medium">{b.name}</span>
                                  <Badge variant={effectivePlan(b, now) === "FREE" ? "secondary" : "default"}>{PLANS[effectivePlan(b, now)].name}</Badge>
                                  <Badge variant="outline" className={m.role === "OWNER" ? "border-primary/40 text-primary" : m.role === "ADMIN" ? "border-warning/40" : undefined}>
                                    {ROLE_LABEL[m.role]}
                                  </Badge>
                                </p>
                                {b.plan !== "FREE" && b.planExpiresAt ? (
                                  <p className={cn("text-xs", b.planExpiresAt > now ? "text-muted-foreground" : "font-medium text-warning")}>
                                    {b.planExpiresAt > now
                                      ? `${PLANS[b.plan].name} hasta el ${longDate(b.planExpiresAt)}`
                                      : `Su plan ${PLANS[b.plan].name} venció el ${longDate(b.planExpiresAt)}`}
                                    {b.planExpiresAt <= now ? (
                                      <a href="#vencidos" className="ml-1.5 font-normal text-primary hover:underline">
                                        Recordarle
                                      </a>
                                    ) : null}
                                  </p>
                                ) : null}
                                <ul className="flex flex-wrap gap-1.5 text-xs" aria-label="Uso del negocio">
                                  {[
                                    b.type ?? "Sin rubro",
                                    `${formatNumber(b._count.sales)} ${b._count.sales === 1 ? "venta" : "ventas"}`,
                                    `${formatNumber(b._count.expenses)} ${b._count.expenses === 1 ? "gasto" : "gastos"}`,
                                    `${formatNumber(b._count.products)} productos`,
                                    `${formatNumber(b._count.members)} ${b._count.members === 1 ? "persona" : "personas"}`,
                                  ].map((t, i) => (
                                    <li key={i} className="max-w-full truncate rounded-md bg-muted px-2 py-0.5 tabular-nums">
                                      {t}
                                    </li>
                                  ))}
                                  {b.discountPercent ? <li className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">Descuento {b.discountPercent}%</li> : null}
                                  {b.extraProducts || b.extraMembers ? (
                                    <li className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
                                      Cupos extra: {[b.extraProducts ? `+${b.extraProducts} productos` : null, b.extraMembers ? `+${b.extraMembers} trabajadores` : null].filter(Boolean).join(" y ")}
                                    </li>
                                  ) : null}
                                </ul>
                                {act?.lastSaleAt ? (
                                  <p className="text-xs text-muted-foreground" title={formatDateTime(act.lastSaleAt, TZ)}>
                                    Última venta <span className="text-foreground">{ago(act.lastSaleAt, now)}</span>
                                    {act.sales30
                                      ? `. En 30 días: ${formatNumber(act.sales30)} ventas por ${clp(act.total30)}, en ${act.days30} ${act.days30 === 1 ? "día" : "días"} distintos`
                                      : ". Sin ventas en 30 días"}
                                  </p>
                                ) : null}
                                {act?.bestProduct ? (
                                  <p className="truncate text-xs text-muted-foreground">
                                    Producto estrella (90 días): <span className="text-foreground">{act.bestProduct.name}</span>, {formatNumber(act.bestProduct.qty)} u. por{" "}
                                    {clp(act.bestProduct.revenue)}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <p className="text-muted-foreground">Sin negocio (no terminó la configuración)</p>
                            )}
                            {u.memberships.length > 1 ? <p className="text-xs text-muted-foreground">Tiene {u.memberships.length - 1} negocio(s) más</p> : null}
                          </div>

                          {/* Estado */}
                          <p className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium @3xl:justify-self-end", status.cls)}>
                            <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden />
                            {status.label}
                          </p>
                        </div>

                        {/* Pie: los datos de la cuenta, como el pie de una boleta, y las acciones. */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-dashed bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
                          <span>Registro {formatDate(u.createdAt, TZ)}</span>
                          <span className="first-letter:uppercase">Llegó por {originLabel(u)}</span>
                          <span title={seen?.title}>
                            Activo{" "}
                            <span className={seen && seen.days < 1 ? "font-medium text-success" : seen && seen.days > 14 ? "text-warning" : "text-foreground"}>
                              {seen?.label ?? "nunca"}
                            </span>
                          </span>
                          {device(u.sessions[0]?.userAgent) ? <span>{device(u.sessions[0]?.userAgent)}</span> : null}
                          <span className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                            {reminderFor ? <RemindUserButton userId={u.id} name={u.name} segment={reminderFor} /> : null}
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
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/admin?para=${u.id}#correo-directo`} aria-label={`Escribirle a ${u.name}`}>
                                <Mail />
                                Escribirle
                              </Link>
                            </Button>
                            {adminEmails.has(u.email.toLowerCase()) ? null : (
                              <DeleteUserDialog
                                userId={u.id}
                                name={u.name}
                                email={u.email}
                                ownedBusinesses={u.memberships
                                  .filter((x) => x.role === "OWNER")
                                  .map((x) => ({ name: x.business.name, sales: x.business._count.sales, others: x.business._count.members - 1 }))}
                              />
                            )}
                          </span>
                        </div>
                      </article>
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
              </div>
            ),
          },
          {
            id: "crecimiento",
            label: "Crecimiento",
            title: "De dónde llegan y qué usan",
            description: "Por qué anuncio entró cada persona, cuántas avanzaron y qué funciones se usan de verdad.",
            content: (
              <div key="crecimiento" className="space-y-6">
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
                  Sin enlace propio, se usa la página de donde vino (Instagram, Facebook, Google…) o queda como “Directo”.
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
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <BarChart3 className="size-3.5" />
              Las visitas a la página (personas, países, dispositivos) se ven en Vercel, en tu proyecto, sección Analytics.
            </p>
              </div>
            ),
          },
          {
            id: "planes",
            label: "Planes y cobros",
            title: "Planes y cobros",
            description: "Planes vencidos, Mercado Pago, códigos de descuento, invitaciones y enlaces con días gratis.",
            count: expiredRows.length || undefined,
            tone: "warning",
            content: (
              <div key="planes" className="space-y-10">
            <div id="vencidos" className="scroll-mt-32 lg:scroll-mt-24 space-y-4">
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <Crown className="size-5 text-warning" />
                  Planes vencidos
                  {expiredRows.length ? <span className="font-normal text-muted-foreground">({formatNumber(expiredRows.length)})</span> : null}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Negocios que tuvieron Pro o Empresa y ya no. Recuérdales, ofréceles un código de descuento o regálales unos días.
                </p>
              </div>
              <ExpiredPlans key={expiredOpen ?? "lista"} rows={expiredRows} coupons={activeCoupons} autoOpen={expiredOpen} />
            </div>
            <div id="cobros" className="scroll-mt-32 lg:scroll-mt-24 space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Crown className="size-5 text-muted-foreground" />
                Cobros (Mercado Pago)
              </h3>
              <div className="grid gap-2 rounded-xl border bg-card p-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Cuenta conectada</p>
                  {mpAccount.ok ? (
                    mpAccount.test ? (
                      <p className="font-medium text-danger">⚠ Es una cuenta de PRUEBA: no cobra dinero real</p>
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
            </div>
            <div id="codigos" className="scroll-mt-32 pt-4 lg:scroll-mt-24 space-y-4">
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <TicketPercent className="size-5 text-muted-foreground" />
                  Códigos de descuento
                </h3>
                <p className="text-sm text-muted-foreground">
                  Los clientes los canjean en Configuración, sección Tu plan. Los de días gratis activan el plan de inmediato; los de porcentaje
                  quedan guardados para cuando empieces a cobrar.
                </p>
              </div>
              <CouponManager coupons={couponRows} />
            </div>
            <div id="invita" className="scroll-mt-32 pt-4 lg:scroll-mt-24 space-y-4">
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <Gift className="size-5 text-muted-foreground" />
                  Invita a un amigo
                </h3>
                <p className="text-sm text-muted-foreground">
                  Cada negocio tiene su enlace en “Invita y gana”. Los días se dan solos: al invitado cuando crea su negocio, y a quien
                  invitó según la regla que elijas (se revisa una vez al día).
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>Reglas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReferralSettings
                      initial={{
                        enabled: referrals.program.enabled,
                        plan: referrals.program.plan === "BUSINESS" ? "BUSINESS" : "PRO",
                        invitedDays: referrals.program.invitedDays,
                        referrerDays: referrals.program.referrerDays,
                        referrerTrigger: referrals.program.referrerTrigger as "REGISTRO" | "VENTAS" | "PAGO",
                        minSales: referrals.program.minSales,
                        maxRewards: referrals.program.maxRewards,
                      }}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Resultados</CardTitle>
                    <CardDescription>
                      {formatNumber(referrals.total)} {referrals.total === 1 ? "negocio llegó invitado" : "negocios llegaron invitados"} ·{" "}
                      {formatNumber(referrals.rewarded)} {referrals.rewarded === 1 ? "recompensa entregada" : "recompensas entregadas"} · {formatNumber(referrals.pending)} pendientes ·{" "}
                      {formatNumber(referrals.days)} días regalados en total
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {referrals.recent.length ? (
                      <ul className="divide-y text-sm">
                        {referrals.recent.map((r) => (
                          <li key={r.id} className="space-y-0.5 py-2.5">
                            <p className="min-w-0">
                              <span className="font-medium break-words">{r.referrer.name}</span>
                              <span className="text-muted-foreground"> invitó a </span>
                              <span className="font-medium break-words">{r.referred.name}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(r.createdAt, TZ)} · invitado: {r.invitedDays} días{r.invitedNote ? ` (${r.invitedNote})` : ""} · quien
                              invitó:{" "}
                              {r.referrerRewardedAt
                                ? `${r.referrerDays ?? 0} días${r.referrerNote ? ` (${r.referrerNote})` : ""}`
                                : `pendiente (${formatNumber(r.referred._count.sales)} ventas)`}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Aún nadie ha llegado invitado.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
            <div id="enlaces" className="scroll-mt-32 pt-4 lg:scroll-mt-24 space-y-4">
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <Link2 className="size-5 text-muted-foreground" />
                  Enlaces especiales
                </h3>
                <p className="text-sm text-muted-foreground">
                  Enlaces que creas tú para tus anuncios, ferias, volantes o alguien que te recomiende. Quien se registra con uno recibe
                  sus días gratis al crear su negocio, y aquí ves cuántos llegaron con cada enlace.
                </p>
              </div>
              <SpecialLinks links={specialRows} baseUrl={getAppUrl()} />
            </div>
              </div>
            ),
          },
          {
            id: "licencias",
            label: "Códigos",
            title: "Códigos del Plan Pro permanente",
            description: "Códigos de activación que se venden en Mercado Libre: se entregan solos al comprador y se canjean en Tu plan, sección Canjear código.",
            content: <LicenseManager key="licencias" data={licenseData} />,
          },
          {
            id: "correos",
            label: "Correos",
            title: "Correos",
            description: "Confirmación de correos, promociones y mensajes a personas específicas.",
            count: unverified.pending || undefined,
            tone: "warning",
            content: (
              <div key="correos" className="space-y-10">
            <div id="recordar-ventas" className="scroll-mt-32 lg:scroll-mt-24 space-y-4">
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <BellRing className="size-5 text-primary" />
                  Recordar que anoten ventas
                </h3>
                <p className="text-sm text-muted-foreground">
                  Para quienes se registraron y no partieron, o dejaron de anotar. El botón del correo abre directo Registrar venta.
                </p>
              </div>
              <SalesReminders key={reminderOpen ?? "lista"} segments={reminderCards} autoOpen={reminderOpen} />
            </div>
            <Card id="confirmar-correos" className="scroll-mt-32 lg:scroll-mt-24">
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
            <div id="promociones" className="scroll-mt-32 pt-4 lg:scroll-mt-24 space-y-4">
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <Mail className="size-5 text-muted-foreground" />
                  Correos de promoción
                </h3>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(audience.counts.ALL)} de {formatNumber(audience.totalUsers)} usuarios aceptaron recibir ofertas. Envíate
                  siempre una prueba antes de mandarlo a todos.
                </p>
              </div>
              <CampaignComposer
                appUrl={getAppUrl()}
                rubros={audience.rubros}
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
                <h4 className="font-semibold">Correo a personas específicas</h4>
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
                            {cm.rubros.length ? ` · rubros: ${cm.rubros.join(", ")}` : ""}
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
            </div>
              </div>
            ),
          },
          {
            id: "equipo",
            label: "Equipo y errores",
            title: "Equipo y errores",
            description: "Quién entra a este panel y qué falló en la app.",
            count: errors.last24 || undefined,
            tone: "danger",
            content: (
              <div key="equipo" className="space-y-10">
            <div id="administradores" className="scroll-mt-32 lg:scroll-mt-24 space-y-4">
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <ShieldCheck className="size-5 text-muted-foreground" />
                  Administradores
                </h3>
                <p className="text-sm text-muted-foreground">Quién puede entrar a este panel.</p>
              </div>
              <AdminsManager admins={adminRows} canManage={isAdminEmail(me.email)} />
            </div>
            <div id="errores" className="scroll-mt-32 pt-4 lg:scroll-mt-24 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <Bug className="size-5 text-muted-foreground" />
                  Errores
                  <span className="font-normal text-muted-foreground">
                    ({formatNumber(errors.last24)} en las últimas 24 horas)
                  </span>
                </h3>
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
            </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

/** Una línea de la boleta: concepto, puntos y cifra. */
function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline gap-2", strong && "font-semibold")}>
      <span className="shrink-0">{label}</span>
      <span className="min-w-4 flex-1 -translate-y-1 border-b border-dotted border-[#13201c]/30" aria-hidden />
      <span className="tabular">{formatNumber(value)}</span>
    </div>
  )
}

function Rule() {
  return <div className="my-2.5 border-t border-dashed border-[#13201c]/25" aria-hidden />
}
