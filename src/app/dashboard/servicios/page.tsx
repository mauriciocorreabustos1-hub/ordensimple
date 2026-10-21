import type { Metadata } from "next"
import Link from "next/link"
import { CalendarCheck, Check, Clock, ExternalLink, Scissors, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDelete } from "@/components/app/confirm-delete"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { ActiveSwitch } from "@/components/products/active-switch"
import { ServiceDialog } from "@/components/services/service-dialog"
import { durationLabel } from "@/lib/agenda"
import { formatMoney } from "@/lib/currency"
import { db } from "@/lib/db"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { storePath } from "@/lib/store"
import { cn } from "@/lib/utils"
import { deleteProduct } from "@/server/actions/products"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "Servicios" }

export default async function ServicesPage() {
  const ctx = await requireBusiness()
  requirePermission(ctx, "products:manage")
  const services = await db.product.findMany({
    where: { businessId: ctx.businessId, isService: true },
    select: { id: true, name: true, price: true, cost: true, durationMin: true, active: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  })
  const money = (n: number) => formatMoney(n, ctx.currency)
  const canManage = can(ctx.role, "products:manage")

  // Qué falta para que los clientes reserven solos en la página del negocio.
  const pro = canUseFeature(ctx.business.plan, "agenda") && canUseFeature(ctx.business.plan, "store")
  const published = Boolean(ctx.business.storeEnabled && ctx.business.storeSlug && ctx.business.storeWhatsapp)
  const bookable = services.filter((s) => s.active && s.price > 0 && s.durationMin).length
  const checks = [
    { ok: pro, label: "Plan Pro", fix: { href: "/dashboard/plan", text: "Ver planes" } },
    { ok: published, label: "Tu página publicada (dirección y WhatsApp)", fix: { href: "/dashboard/configuracion?seccion=tienda", text: "Publicarla" } },
    { ok: ctx.settings.bookingEnabled, label: "Reservas activadas y horario de atención", fix: { href: "/dashboard/configuracion?seccion=tienda#reservas", text: "Activarlas" } },
    { ok: bookable > 0, label: bookable ? `${bookable} servicio${bookable === 1 ? "" : "s"} para reservar` : "Al menos un servicio activo con precio", fix: null },
  ]
  const ready = checks.every((c) => c.ok)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Servicios"
        description="Lo que haces con tus manos o tu tiempo: cortes, consultas, clases, arreglos… Cada uno con su precio y cuánto dura, para agendarlo y cobrarlo."
        actions={canManage ? <ServiceDialog currency={ctx.currency} /> : null}
      />

      <section className={cn("rounded-2xl border p-4", ready ? "border-primary/30 bg-primary/5" : "bg-card")} aria-labelledby="reservas-online">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarCheck className="size-5" />
            </span>
            <div>
              <h2 id="reservas-online" className="font-semibold">
                {ready ? "Tus clientes ya pueden reservar hora solos" : "Reservas online: te falta poco"}
              </h2>
              <ul className="mt-1.5 space-y-1 text-sm">
                {checks.map((c) => (
                  <li key={c.label} className="flex flex-wrap items-center gap-x-2">
                    {c.ok ? <Check className="size-4 text-primary" /> : <X className="size-4 text-muted-foreground" />}
                    <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
                    {!c.ok && c.fix ? (
                      <Link href={c.fix.href} className="font-medium text-primary hover:underline">
                        {c.fix.text}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {ready ? (
            <Button variant="outline" asChild>
              <a href={storePath(ctx.business.storeSlug!)} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Ver mi página de reservas
              </a>
            </Button>
          ) : null}
        </div>
      </section>

      {services.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="Aún no tienes servicios"
          description="Agrega lo que ofreces con su precio y cuánto dura (ej.: Corte de pelo, $12.000, 30 min). Así los eliges al agendar, al cobrar y tus clientes los reservan."
          action={canManage ? <ServiceDialog currency={ctx.currency} /> : null}
        />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {services.map((s) => (
            <li key={s.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", !s.active && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  {s.durationMin ? durationLabel(s.durationMin) : "Sin duración"}
                  {s.cost ? ` · te queda ${money(s.price - s.cost)}` : ""}
                </p>
              </div>
              <span className="tabular font-semibold">{money(s.price)}</span>
              {canManage ? (
                <div className="flex items-center gap-1">
                  <ActiveSwitch id={s.id} active={s.active} />
                  <ServiceDialog
                    serviceId={s.id}
                    initial={{ name: s.name, price: s.price, cost: s.cost, durationMin: s.durationMin ?? 30, active: s.active }}
                    currency={ctx.currency}
                  />
                  <ConfirmDelete
                    title="¿Eliminar este servicio?"
                    description={`"${s.name}" se eliminará. Las ventas y citas anteriores se mantienen.`}
                    onConfirm={deleteProduct.bind(null, s.id)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
