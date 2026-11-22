import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { VisitsChart } from "@/components/links/stats/visits-chart"
import { ProTag } from "@/components/links/editor/fields"
import { toDateKey } from "@/lib/dates"
import { db } from "@/lib/db"
import { readContent, SOURCE_LABEL } from "@/lib/links"
import { cn } from "@/lib/utils"
import { LINK_BUSINESS_SELECT, linksPro } from "@/server/links"
import { linkStats } from "@/server/queries/links-stats"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "Estadísticas de Links" }

const PERIODS = [
  { id: "7", label: "7 días", days: 7, pro: false },
  { id: "30", label: "30 días", days: 30, pro: true },
  { id: "90", label: "90 días", days: 90, pro: true },
] as const

const DEVICE_LABEL: Record<string, string> = { mobile: "Celular", tablet: "Tablet", desktop: "Computador" }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function shift(dayKey: string, days: number) {
  const d = new Date(`${dayKey}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function LinkStatsPage({ searchParams }: PageProps<"/dashboard/links/estadisticas">) {
  const ctx = await requireBusiness()
  requirePermission(ctx, "settings:manage")
  const sp = await searchParams
  const [page, business] = await Promise.all([
    db.linkPage.findUnique({ where: { businessId: ctx.businessId }, select: { id: true, slug: true, published: true, live: true, draft: true } }),
    db.business.findUniqueOrThrow({ where: { id: ctx.businessId }, select: LINK_BUSINESS_SELECT }),
  ])
  const pro = linksPro(business)
  const today = toDateKey(new Date(), business.timezone)

  // El período: en Gratis, los últimos 7 días; en Pro, también 30, 90 o un rango propio (hasta un año).
  const wanted = typeof sp.periodo === "string" ? sp.periodo : "7"
  let from = shift(today, -6)
  let to = today
  let period: string = "7"
  let locked = false
  if (wanted === "rango" && typeof sp.desde === "string" && typeof sp.hasta === "string" && DATE_RE.test(sp.desde) && DATE_RE.test(sp.hasta)) {
    if (pro) {
      const a = sp.desde <= sp.hasta ? sp.desde : sp.hasta
      const b = sp.desde <= sp.hasta ? sp.hasta : sp.desde
      to = b > today ? today : b
      from = a < shift(to, -365) ? shift(to, -365) : a
      period = "rango"
    } else locked = true
  } else {
    const p = PERIODS.find((x) => x.id === wanted)
    if (p && (!p.pro || pro)) {
      from = shift(today, -(p.days - 1))
      period = p.id
    } else if (p) locked = true
  }

  if (!page) {
    return (
      <div className="space-y-6">
        <PageHeader title="Estadísticas de Links" />
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">Primero crea tu página de enlaces</p>
          <p className="mt-1 text-sm text-muted-foreground">Cuando la publiques, aquí verás cuántas personas la visitan y qué botones tocan.</p>
          <Button className="mt-4" asChild>
            <Link href="/dashboard/links">Crear mi página</Link>
          </Button>
        </div>
      </div>
    )
  }

  const content = readContent(page.live) ?? readContent(page.draft)
  const stats = await linkStats(page.id, content, { from, to }, business.timezone, pro)
  const fmt = (n: number) => n.toLocaleString("es-CL")
  const range = `${new Date(`${from}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short" })} al ${new Date(`${to}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}`
  const countryName = new Intl.DisplayNames(["es"], { type: "region" })
  const maxClicks = Math.max(1, ...stats.links.map((l) => l.clicks))

  return (
    <div className="space-y-6" data-enter>
      <PageHeader
        title="Estadísticas de Links"
        description="Visitas y clics reales de tu página. No contamos robots ni guardamos datos personales de quienes la visitan."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/links">
              <ArrowLeft /> Volver al editor
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <nav aria-label="Período" className="flex gap-1 rounded-lg bg-muted p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={`?periodo=${p.id}`}
              aria-current={period === p.id ? "page" : undefined}
              className={cn("flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium", period === p.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {p.label}
              {p.pro && !pro ? <ProTag /> : null}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap items-end gap-2" action="">
          <input type="hidden" name="periodo" value="rango" />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">Desde {!pro ? <ProTag /> : null}</span>
            <Input type="date" name="desde" defaultValue={from} max={today} className="h-9 w-40" disabled={!pro} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Hasta</span>
            <Input type="date" name="hasta" defaultValue={to} max={today} className="h-9 w-40" disabled={!pro} />
          </label>
          <Button type="submit" variant="outline" className="h-9" disabled={!pro}>
            Ver
          </Button>
        </form>
      </div>

      {locked ? (
        <p className="rounded-xl bg-primary/[0.07] px-4 py-3 text-sm">
          Los períodos de 30 y 90 días y los rangos propios son del plan Pro. Te mostramos los últimos 7 días.{" "}
          <Link href="/dashboard/plan" className="font-medium text-primary underline-offset-2 hover:underline">
            Ver el plan Pro
          </Link>
        </p>
      ) : null}
      {!page.published ? <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Tu página no está publicada: no recibe visitas nuevas hasta que la publiques.</p> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {/* El resumen, impreso como boleta. */}
        <section aria-labelledby="lk-resumen" className="receipt-edge bg-[#fbfaf6] px-5 pt-5 pb-10 font-mono text-[#13201c] drop-shadow-[0_10px_24px_rgb(0_40_30/0.10)] dark:bg-card dark:text-foreground">
          <h2 id="lk-resumen" className="text-center text-sm font-semibold">
            Tu página, del {range}
          </h2>
          <dl className="mt-4 space-y-3 border-y border-dashed border-current/25 py-4 text-[14px]">
            {[
              ["Visitas", fmt(stats.views)],
              ["Visitantes únicos*", fmt(stats.uniques)],
              ["Clics", fmt(stats.clicks)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline">
                <dt>{k}</dt>
                <span aria-hidden className="mx-2 min-w-6 flex-1 -translate-y-[3px] border-b border-dotted border-current/30" />
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-baseline justify-between gap-3 pt-4">
            <span className="font-semibold">Tasa de clics</span>
            <span className="text-3xl font-semibold tracking-tight text-success tabular-nums">{stats.ctr === null ? "—" : `${Math.round(stats.ctr * 100)} %`}</span>
          </div>
          <p className="mt-4 border-t border-dashed border-current/25 pt-3 font-sans text-xs text-pretty text-[#3d4d48] dark:text-muted-foreground">
            Tasa de clics: clics dividido por visitas. *Visitantes únicos es una estimación: contamos personas distintas por día, sin cookies, y las sumamos.
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="lk-dias">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="lk-dias" className="font-semibold">
              Día a día
            </h2>
            <p className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-primary" /> Visitas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0 w-4 border-t-2 border-dashed border-[color-mix(in_oklch,var(--primary)_40%,var(--foreground))]" /> Clics
              </span>
            </p>
          </div>
          {stats.views || stats.clicks ? (
            <div className="mt-4 h-64">
              <VisitsChart data={stats.series} />
            </div>
          ) : (
            <div className="mt-4 grid h-64 place-items-center rounded-xl border border-dashed text-center">
              <div className="max-w-xs space-y-1 px-4">
                <p className="font-medium">Todavía no hay visitas en estos días</p>
                <p className="text-sm text-muted-foreground">Comparte tu enlace en tu biografía de Instagram, TikTok o en tu estado de WhatsApp para empezar a recibirlas.</p>
              </div>
            </div>
          )}
          <table className="sr-only">
            <caption>Visitas y clics por día</caption>
            <thead>
              <tr>
                <th>Día</th>
                <th>Visitas</th>
                <th>Clics</th>
              </tr>
            </thead>
            <tbody>
              {stats.series.map((r) => (
                <tr key={r.day}>
                  <td>{r.day}</td>
                  <td>{r.views}</td>
                  <td>{r.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="lk-botones">
        <h2 id="lk-botones" className="font-semibold">
          Los botones más tocados
        </h2>
        {stats.links.length ? (
          <ol className="mt-4 space-y-3">
            {stats.links.map((l, i) => (
              <li key={l.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{l.label}</span>
                  {l.type ? <span className="block text-xs text-muted-foreground">{l.type}</span> : null}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {fmt(l.clicks)} <span className="font-normal text-muted-foreground">{stats.views ? `· ${Math.round((l.clicks / stats.views) * 100)} %` : ""}</span>
                </span>
                <span aria-hidden className="col-start-2 col-end-4 h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(l.clicks / maxClicks) * 100}%` }} />
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Cuando alguien toque un botón de tu página, aparecerá aquí.</p>
        )}
      </section>

      {pro ? (
        <div className="grid gap-6 md:grid-cols-3">
          <Breakdown title="De dónde llegan" rows={stats.sources.map((r) => ({ label: SOURCE_LABEL[r.key] ?? r.key, n: r.n }))} total={stats.views} empty="Sin visitas todavía" />
          <Breakdown title="Desde qué equipo" rows={stats.devices.map((r) => ({ label: DEVICE_LABEL[r.key] ?? r.key, n: r.n }))} total={stats.views} empty="Sin visitas todavía" />
          <Breakdown
            title="Desde qué país"
            rows={stats.countries.map((r) => ({ label: r.key ? (countryName.of(r.key) ?? r.key) : "No se sabe", n: r.n }))}
            total={stats.views}
            empty="Sin visitas todavía"
            note="Aproximado, según la conexión."
          />
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <ProTag /> Con Pro ves de dónde llegan tus visitas (Instagram, WhatsApp, tu QR…), desde qué equipo y desde qué país.
          <Link href="/dashboard/plan" className="font-medium text-primary underline-offset-2 hover:underline">
            Ver el plan Pro
          </Link>
        </p>
      )}
    </div>
  )
}

function Breakdown({ title, rows, total, empty, note }: { title: string; rows: { label: string; n: number }[]; total: number; empty: string; note?: string }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length ? (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 8).map((r) => (
            <li key={r.label} className="flex items-baseline gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="font-medium tabular-nums">{r.n.toLocaleString("es-CL")}</span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{total ? `${Math.round((r.n / total) * 100)} %` : ""}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      )}
      {note ? <p className="mt-3 text-xs text-muted-foreground">{note}</p> : null}
    </section>
  )
}
