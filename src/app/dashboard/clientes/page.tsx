import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Crown, NotebookPen, Repeat, Search, Sparkles, Users, MessageCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { StatCard } from "@/components/app/stat-card"
import { CustomerDialog } from "@/components/contacts/customer-dialog"
import { formatMoney, formatNumber } from "@/lib/currency"
import { formatDate } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { getCustomers, type CustomerSegment } from "@/server/queries/contacts"
import { getDebtors } from "@/server/queries/fiado"
import { requireBusiness } from "@/server/session"
import { fiadoReminderText, whatsappLink } from "@/lib/whatsapp"

export const metadata: Metadata = { title: "Clientes" }

const SEGMENTS: { value: CustomerSegment; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "deben", label: "Te deben" },
  { value: "frecuentes", label: "Frecuentes" },
  { value: "nuevos", label: "Nuevos" },
  { value: "top", label: "Mayor compra" },
]

export default async function CustomersPage({ searchParams }: PageProps<"/dashboard/clientes">) {
  const ctx = await requireBusiness()
  if (!canUseFeature(ctx.business.plan, "customers")) {
    return <ProGate title="Clientes" description="Conoce a quienes te compran y cuánto te compran." />
  }
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : ""
  const segment = SEGMENTS.some((s) => s.value === params.segmento) ? (params.segmento as CustomerSegment) : "todos"
  const [data, debts] = await Promise.all([
    getCustomers(ctx.businessId, ctx.timezone, { q: q || undefined }),
    getDebtors(ctx.businessId),
  ])
  const owes = (id: string) => Math.max(0, debts.balances.get(id)?.balance ?? 0)
  const debtors = data.rows.filter((r) => owes(r.id) > 0).sort((a, b) => owes(b.id) - owes(a.id))
  const money = (n: number) => formatMoney(n, ctx.currency)
  const canManage = can(ctx.role, "customers:manage")

  const list =
    segment === "deben"
      ? debtors
      : segment === "frecuentes"
        ? data.frequent
        : segment === "nuevos"
          ? data.newOnes
          : segment === "top"
            ? data.top
            : data.rows
  const best = data.top[0]

  const hrefFor = (s: CustomerSegment) => {
    const p = new URLSearchParams()
    if (s !== "todos") p.set("segmento", s)
    if (q) p.set("q", q)
    const qs = p.toString()
    return `/dashboard/clientes${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Quién te compra, cuánto y cada cuánto. Las ventas con nombre de cliente se suman solas aquí."
        actions={canManage ? <CustomerDialog /> : null}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard compactOnMobile label="Clientes" value={formatNumber(data.rows.length)} icon={Users}
          hint={`${data.newOnes.length} nuevos en los últimos 30 días.`} />
        <StatCard compactOnMobile label="Te deben (fiado)" value={money(debts.total)} icon={NotebookPen}
          tone={debts.total > 0 ? "expenses" : "default"}
          hint={debts.count ? `${debts.count} ${debts.count === 1 ? "cliente tiene" : "clientes tienen"} deuda pendiente.` : "Nadie te debe. ¡Bien!"} />
        <StatCard compactOnMobile label="Frecuentes" value={formatNumber(data.frequent.length)} icon={Repeat} tone="sales"
          hint="Te compraron 3 veces o más en los últimos 60 días." />
        <StatCard compactOnMobile label="Mejor cliente" value={best ? best.name : "—"} icon={Crown} tone="profit"
          hint={best ? `${money(best.total)} en ${best.purchases} compras.` : "Aún no hay ventas con cliente."} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SEGMENTS.map((s) => (
            <Link
              key={s.value}
              href={hrefFor(s.value)}
              scroll={false}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-sm",
                segment === s.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <form className="flex gap-2" action="/dashboard/clientes">
          {segment !== "todos" ? <input type="hidden" name="segmento" value={segment} /> : null}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Buscar por nombre, teléfono o correo" className="h-9 pl-9 md:w-72" />
          </div>
          <Button type="submit" variant="outline" size="lg">
            Buscar
          </Button>
        </form>
      </div>

      {data.rows.length === 0 && !q ? (
        <EmptyState
          icon={Users}
          title="Aún no tienes clientes"
          description="Agrégalos aquí o escribe el nombre del cliente al registrar una venta con detalle: se creará solo."
          action={canManage ? <CustomerDialog /> : null}
        />
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay clientes en esta vista.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {list.map((c) => (
            <li key={c.id} className="flex items-stretch gap-2">
              <Link
                href={`/dashboard/clientes/${c.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {c.name
                    .split(" ")
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium">
                    <span className="min-w-0 truncate">{c.name}</span>
                    {c.recentPurchases >= 3 ? (
                      <Badge variant="secondary" className="gap-1">
                        <Repeat className="size-3" />
                        Frecuente
                      </Badge>
                    ) : null}
                    {owes(c.id) > 0 ? (
                      <Badge className="gap-1 border-warning/40 bg-warning/15 text-foreground">
                        <NotebookPen className="size-3 text-warning" />
                        Debe {money(owes(c.id))}
                      </Badge>
                    ) : null}
                    {c.isNew ? (
                      <Badge variant="outline" className="gap-1">
                        <Sparkles className="size-3" />
                        Nuevo
                      </Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.purchases} {c.purchases === 1 ? "compra" : "compras"}
                    {c.lastPurchase ? ` · última ${formatDate(c.lastPurchase, ctx.timezone)}` : ""}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </p>
                </div>
                <span className="tabular shrink-0 font-semibold">{money(c.total)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
              {owes(c.id) > 0 ? (
                <a
                  href={whatsappLink(c.phone, fiadoReminderText({ customerName: c.name, businessName: ctx.business.name, amount: money(owes(c.id)) }))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border bg-card text-[11px] font-medium text-success transition-colors hover:border-success/40 hover:bg-success/10"
                  aria-label={`Cobrar a ${c.name} por WhatsApp`}
                  title={c.phone ? "Cobrar por WhatsApp" : "Cobrar por WhatsApp (eliges el contacto)"}
                >
                  <MessageCircle className="size-5" />
                  Cobrar
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
