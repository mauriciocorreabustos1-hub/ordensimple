import type { Metadata } from "next"
import { CalendarDays } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { AgendaBoard, type AgendaAppointment } from "@/components/agenda/agenda-board"
import { db } from "@/lib/db"
import { addDays, dateKeyToUtc, startOfWeek, toDateKey } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Agenda" }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function AgendaPage({ searchParams }: PageProps<"/dashboard/agenda">) {
  const ctx = await requireBusiness()
  if (!canUseFeature(ctx.business.plan, "agenda")) {
    return <ProGate title="Agenda" description="Agenda tus citas por profesional, recuérdalas por WhatsApp y cóbralas con un toque." />
  }
  const params = await searchParams
  const today = toDateKey(new Date(), ctx.timezone)
  const day = typeof params.dia === "string" && DATE_RE.test(params.dia) ? params.dia : today
  const from = dateKeyToUtc(day, ctx.timezone)
  const to = addDays(from, 1, ctx.timezone)
  const weekFrom = startOfWeek(from, ctx.timezone)
  const weekTo = addDays(weekFrom, 7, ctx.timezone)

  const [appointments, week, members, services, customers] = await Promise.all([
    db.appointment.findMany({
      where: { businessId: ctx.businessId, startAt: { gte: from, lt: to } },
      orderBy: { startAt: "asc" },
      include: { staff: { select: { name: true } } },
    }),
    db.appointment.findMany({
      where: { businessId: ctx.businessId, startAt: { gte: weekFrom, lt: weekTo }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      select: { startAt: true },
    }),
    db.businessMember.findMany({
      where: { businessId: ctx.businessId },
      select: { userId: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.product.findMany({
      where: { businessId: ctx.businessId, active: true, isService: true },
      select: { id: true, name: true, price: true, durationMin: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
    db.customer.findMany({ where: { businessId: ctx.businessId }, select: { name: true, phone: true }, orderBy: { updatedAt: "desc" }, take: 300 }),
  ])

  const weekCounts: Record<string, number> = {}
  for (const a of week) {
    const k = toDateKey(a.startAt, ctx.timezone)
    weekCounts[k] = (weekCounts[k] ?? 0) + 1
  }
  const rows: AgendaAppointment[] = appointments.map((a) => ({
    id: a.id,
    customerName: a.customerName,
    customerPhone: a.customerPhone,
    productId: a.productId,
    serviceName: a.serviceName,
    price: a.price,
    staffId: a.staffId,
    staffName: a.staff?.name ?? null,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    status: a.status,
    note: a.note,
    charged: Boolean(a.saleId),
    reminded: Boolean(a.remindedAt),
    online: a.source === "ONLINE",
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Tus citas del día por profesional. Recuérdalas por WhatsApp y cóbralas con un toque: quedan como venta."
      />
      <AgendaBoard
        key={day}
        day={day}
        today={today}
        weekStart={toDateKey(weekFrom, ctx.timezone)}
        weekCounts={weekCounts}
        appointments={rows}
        staff={members.map((m) => ({ id: m.userId, name: m.user.name }))}
        services={services
          .filter((s) => s.price > 0)
          .map((s) => ({ id: s.id, name: s.name, price: s.price, durationMin: s.durationMin ?? 30 }))}
        customers={customers.map((c) => ({ name: c.name, phone: c.phone }))}
        currency={ctx.currency}
        timezone={ctx.timezone}
        businessName={ctx.business.name}
        meId={ctx.user.id}
        defaultPayment={ctx.settings.defaultPayment}
      />
      {rows.length === 0 && Object.keys(weekCounts).length === 0 ? (
        <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          Toca «Nueva cita» o una hora libre para agendar.
        </p>
      ) : null}
    </div>
  )
}
