"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ChevronLeft, ChevronRight, Clock, Loader2, MessageCircle, Pencil, Plus, Trash2, UserRound, X } from "lucide-react"
import { toast } from "sonner"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { AppModal } from "@/components/app/app-modal"
import { MoneyInput } from "@/components/app/money-input"
import { PaymentChips } from "@/components/app/payment-chips"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { APPOINTMENT_STATUS, appointmentReminderText, clockOf, durationLabel, hhmm, type AppointmentStatusKey } from "@/lib/agenda"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { whatsappLink } from "@/lib/whatsapp"
import {
  chargeAppointment,
  createAppointment,
  markAppointmentReminded,
  setAppointmentStatus,
  deleteAppointment,
  updateAppointment,
} from "@/server/actions/agenda"

export type AgendaAppointment = {
  id: string
  customerName: string
  customerPhone: string | null
  productId: string | null
  serviceName: string
  price: number
  staffId: string | null
  staffName: string | null
  startAt: string
  endAt: string
  status: AppointmentStatusKey
  note: string | null
  charged: boolean
  reminded: boolean
  /** La reservó el cliente en la página del negocio. */
  online: boolean
}
type Staff = { id: string; name: string }
type Service = { id: string; name: string; price: number; durationMin: number | null }
type Customer = { name: string; phone: string | null }

const HOUR_PX = 64
const POLL_MS = 30_000
const UNASSIGNED = "__sin__"

/** Fecha "AAAA-MM-DD" ± días (sin zona horaria: solo calendario). */
function shiftDay(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", ...opts }).format(new Date(`${day}T12:00:00Z`))

export function AgendaBoard({
  day,
  today,
  weekStart,
  weekCounts,
  appointments,
  staff,
  services,
  customers,
  currency,
  timezone,
  businessName,
  meId,
  defaultPayment,
  canDelete = false,
}: {
  day: string
  today: string
  weekStart: string
  weekCounts: Record<string, number>
  appointments: AgendaAppointment[]
  staff: Staff[]
  services: Service[]
  customers: Customer[]
  currency: string
  timezone: string
  businessName: string
  meId: string
  defaultPayment: PaymentMethod
  /** Dueño o administrador: puede eliminar citas. */
  canDelete?: boolean
}) {
  const router = useRouter()
  const money = (n: number) => formatMoney(n, currency)
  const [editing, setEditing] = React.useState<{ appointment?: AgendaAppointment; staffId?: string; time?: string } | null>(null)
  const [openId, setOpenId] = React.useState<string | null>(null)
  const open = appointments.find((a) => a.id === openId) ?? null

  // Las citas que agenda otra persona aparecen solas.
  React.useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), POLL_MS)
    return () => clearInterval(t)
  }, [router])

  const [reminding, setReminding] = React.useState(false)
  const active = appointments.filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
  // A quién recordar: las citas del día que siguen en pie y no se han cobrado.
  const remindable = appointments.filter((a) => (a.status === "SCHEDULED" || a.status === "CONFIRMED") && !a.charged)
  const expected = active.reduce((s, a) => s + a.price, 0)
  const minutes = (iso: string) => {
    const c = clockOf(iso, timezone)
    return c.hour * 60 + c.minute
  }

  // Columnas: cada persona del equipo (y "Sin asignar" si hay citas sin profesional).
  const columns: Staff[] = [
    ...(staff.length > 1 ? staff : staff.length === 1 ? staff : []),
    ...(appointments.some((a) => !a.staffId) || staff.length === 0 ? [{ id: UNASSIGNED, name: staff.length ? "Sin asignar" : "Citas" }] : []),
  ]
  const startHour = Math.min(8, ...appointments.map((a) => Math.floor(minutes(a.startAt) / 60)))
  const endHour = Math.max(20, ...appointments.map((a) => Math.ceil(Math.max(minutes(a.endAt), minutes(a.startAt) + 15) / 60)))
  const hours = Array.from({ length: Math.min(24, endHour) - startHour }, (_, i) => startHour + i)
  const nowMin = day === today ? minutes(new Date().toISOString()) : null

  return (
    <div className="space-y-4">
      {/* Días */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/agenda?dia=${shiftDay(day, -1)}`} aria-label="Día anterior">
              <ChevronLeft />
            </Link>
          </Button>
          <p className="min-w-40 text-center text-sm font-medium first-letter:uppercase">
            {day === today ? "Hoy, " : ""}
            {dayLabel(day, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/agenda?dia=${shiftDay(day, 1)}`} aria-label="Día siguiente">
              <ChevronRight />
            </Link>
          </Button>
        </div>
        {day !== today ? (
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/agenda">Hoy</Link>
          </Button>
        ) : null}
        {remindable.length ? (
          <Button variant="outline" className="ml-auto" onClick={() => setReminding(true)}>
            <MessageCircle />
            Recordar a todos ({remindable.length})
          </Button>
        ) : null}
        <Button className={remindable.length ? "" : "ml-auto"} onClick={() => setEditing({})}>
          <Plus />
          Nueva cita
        </Button>
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i)).map((d) => (
          <Link
            key={d}
            href={`/dashboard/agenda?dia=${d}`}
            aria-current={d === day ? "date" : undefined}
            className={cn(
              "flex min-w-14 shrink-0 flex-col items-center rounded-xl border px-2 py-1.5 text-xs",
              d === day ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            <span className="capitalize">{dayLabel(d, { weekday: "short" }).replace(".", "")}</span>
            <span className="text-base font-semibold">{Number(d.slice(8))}</span>
            <span className={cn("text-[10px]", d === day ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {weekCounts[d] ? `${weekCounts[d]} cita${weekCounts[d] === 1 ? "" : "s"}` : d === today ? "hoy" : "libre"}
            </span>
          </Link>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {active.length ? (
          <>
            <span className="font-medium text-foreground">
              {active.length} cita{active.length === 1 ? "" : "s"}
            </span>{" "}
            · {money(expected)} por cobrar{appointments.some((a) => a.charged) ? ` · ${appointments.filter((a) => a.charged).length} cobradas` : ""}
          </>
        ) : (
          "No hay citas este día."
        )}
      </p>

      {/* Celular: lista por hora */}
      <ul className="space-y-2 md:hidden">
        {appointments.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => setOpenId(a.id)} className={cn("flex w-full items-stretch gap-3 rounded-xl border p-3 text-left", APPOINTMENT_STATUS[a.status].tone)}>
              <span className="tabular w-12 shrink-0 text-sm font-semibold">{hhmm(minutes(a.startAt))}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {a.customerName}
                  {a.online ? <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Online</span> : null}
                </span>
                <span className="block truncate text-xs opacity-80">
                  {a.serviceName}
                  {a.staffName ? ` · ${a.staffName.split(" ")[0]}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs">
                <span className="block font-medium">{APPOINTMENT_STATUS[a.status].label}</span>
                <span className="tabular block opacity-80">{money(a.price)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Computador: columnas por profesional */}
      <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
        <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(180px, 1fr))` }}>
          <div className="sticky top-0 z-10 border-b bg-card" />
          {columns.map((c) => (
            <div key={c.id} className="sticky top-0 z-10 flex items-center gap-2 border-b border-l bg-card px-3 py-2 text-sm font-medium">
              <UserRound className="size-4 text-muted-foreground" />
              <span className="truncate">{c.id === meId ? `${c.name.split(" ")[0]} (tú)` : c.name}</span>
            </div>
          ))}
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <span key={h} className="tabular absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : hhmm(h * 60)}
              </span>
            ))}
          </div>
          {columns.map((c) => (
            <div key={c.id} className="relative border-l" style={{ height: hours.length * HOUR_PX }}>
              {/* Horas libres: tocarlas agenda ahí */}
              {hours.flatMap((h, i) =>
                [0, 30].map((m) => (
                  <button
                    key={`${h}:${m}`}
                    type="button"
                    aria-label={`Agendar a las ${hhmm(h * 60 + m)}${c.id !== UNASSIGNED ? ` con ${c.name}` : ""}`}
                    onClick={() => setEditing({ staffId: c.id === UNASSIGNED ? undefined : c.id, time: hhmm(h * 60 + m) })}
                    className={cn("absolute inset-x-0 hover:bg-primary/5", m === 0 ? "border-t" : "border-t border-dashed border-muted")}
                    style={{ top: i * HOUR_PX + (m ? HOUR_PX / 2 : 0), height: HOUR_PX / 2 }}
                  />
                )),
              )}
              {nowMin !== null && nowMin >= startHour * 60 && nowMin <= endHour * 60 ? (
                <div className="pointer-events-none absolute inset-x-0 z-[5] border-t-2 border-red-500" style={{ top: ((nowMin - startHour * 60) / 60) * HOUR_PX }} />
              ) : null}
              {appointments
                .filter((a) => (c.id === UNASSIGNED ? !a.staffId || !staff.some((s) => s.id === a.staffId) : a.staffId === c.id))
                .map((a) => {
                  const top = ((minutes(a.startAt) - startHour * 60) / 60) * HOUR_PX
                  const height = Math.max(26, ((minutes(a.endAt) - minutes(a.startAt)) / 60) * HOUR_PX - 2)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setOpenId(a.id)}
                      className={cn("absolute inset-x-1 z-[6] overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm hover:ring-2 hover:ring-primary/30", APPOINTMENT_STATUS[a.status].tone)}
                      style={{ top: top + 1, height }}
                    >
                      <span className="block truncate font-semibold">
                        {hhmm(minutes(a.startAt))} {a.customerName}
                      </span>
                      {height > 34 ? <span className="block truncate opacity-80">{a.serviceName}</span> : null}
                    </button>
                  )
                })}
            </div>
          ))}
        </div>
      </div>

      {editing ? (
        <AppointmentForm
          key={editing.appointment?.id ?? "nueva"}
          day={day}
          initial={editing}
          staff={staff}
          services={services}
          customers={customers}
          currency={currency}
          timezone={timezone}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      ) : null}
      {reminding ? (
        <RemindAll
          appointments={remindable}
          day={day}
          businessName={businessName}
          timezone={timezone}
          onClose={() => {
            setReminding(false)
            router.refresh()
          }}
        />
      ) : null}
      {open ? (
        <AppointmentDetail
          appointment={open}
          day={day}
          businessName={businessName}
          currency={currency}
          timezone={timezone}
          defaultPayment={defaultPayment}
          canDelete={canDelete}
          onEdit={() => {
            setOpenId(null)
            setEditing({ appointment: open })
          }}
          onClose={() => setOpenId(null)}
          onChanged={() => router.refresh()}
        />
      ) : null}
    </div>
  )
}

function AppointmentForm({
  day,
  initial,
  staff,
  services,
  customers,
  currency,
  timezone,
  onClose,
  onSaved,
}: {
  day: string
  initial: { appointment?: AgendaAppointment; staffId?: string; time?: string }
  staff: Staff[]
  services: Service[]
  customers: Customer[]
  currency: string
  timezone: string
  onClose: () => void
  onSaved: () => void
}) {
  const a = initial.appointment
  const startClock = a ? clockOf(a.startAt, timezone) : null
  const [customerName, setCustomerName] = React.useState(a?.customerName ?? "")
  const [customerPhone, setCustomerPhone] = React.useState(a?.customerPhone ?? "")
  const [productId, setProductId] = React.useState<string | null>(a?.productId ?? null)
  const [serviceName, setServiceName] = React.useState(a?.serviceName ?? "")
  const [price, setPrice] = React.useState(a?.price ?? 0)
  const [staffId, setStaffId] = React.useState(a?.staffId ?? initial.staffId ?? (staff.length === 1 ? staff[0].id : ""))
  const [date, setDate] = React.useState(day)
  const [time, setTime] = React.useState(startClock ? hhmm(startClock.hour * 60 + startClock.minute) : (initial.time ?? "10:00"))
  const [duration, setDuration] = React.useState(a ? Math.round((new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60_000) : 30)
  const [note, setNote] = React.useState(a?.note ?? "")
  const [query, setQuery] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  const q = query.trim().toLowerCase()
  const shownServices = services.filter((s) => !q || s.name.toLowerCase().includes(q)).slice(0, 12)

  function pickService(s: Service) {
    setProductId(s.id)
    setServiceName(s.name)
    setPrice(s.price)
    if (s.durationMin) setDuration(s.durationMin)
    setQuery("")
  }

  function pickCustomer(name: string) {
    setCustomerName(name)
    const c = customers.find((x) => x.name.toLowerCase() === name.trim().toLowerCase())
    if (c?.phone && !customerPhone) setCustomerPhone(c.phone)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!serviceName.trim()) return void toast.error("Elige o escribe el servicio.")
    startTransition(async () => {
      const input = {
        customerName,
        customerPhone: customerPhone || undefined,
        productId: productId ?? undefined,
        serviceName,
        price,
        staffId: staffId || undefined,
        date,
        time,
        durationMin: duration,
        note: note || undefined,
      }
      const r = a ? await updateAppointment(a.id, input) : await createAppointment(input)
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message ?? "Guardado")
      onSaved()
    })
  }

  return (
    <AppModal open onOpenChange={(o) => !o && onClose()} title={a ? "Editar cita" : "Nueva cita"} noAutoFocus>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="ag-customer" className="text-sm font-medium">
              Cliente
            </label>
            <Input id="ag-customer" list="ag-customers" value={customerName} onChange={(e) => pickCustomer(e.target.value)} required minLength={2} maxLength={80} className="h-10" />
            <datalist id="ag-customers">
              {customers.map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ag-phone" className="text-sm font-medium">
              Teléfono <span className="font-normal text-muted-foreground">(para el recordatorio)</span>
            </label>
            <Input id="ag-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} inputMode="tel" maxLength={20} placeholder="9 1234 5678" className="h-10" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Servicio</p>
          {services.length > 6 ? <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar servicio" className="h-9" aria-label="Buscar servicio" /> : null}
          {services.length ? (
            <div className="flex flex-wrap gap-1.5">
              {shownServices.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickService(s)}
                  aria-pressed={productId === s.id}
                  className={cn("rounded-full border px-3 py-1.5 text-sm", productId === s.id ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
                >
                  {s.name}
                  {s.durationMin ? <span className="text-xs text-muted-foreground"> · {durationLabel(s.durationMin)}</span> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Tip: crea tus servicios en{" "}
              <Link href="/dashboard/productos" className="text-primary hover:underline">
                Servicios
              </Link>{" "}
              con su precio y duración, y aquí los eliges con un toque.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
            <Input
              value={serviceName}
              onChange={(e) => {
                setServiceName(e.target.value)
                setProductId(null)
              }}
              placeholder="O escríbelo (ej.: Corte + barba)"
              maxLength={100}
              aria-label="Servicio"
              className="h-10"
            />
            <MoneyInput value={price} onValueChange={setPrice} currency={currency} aria-label="Precio" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="ag-date" className="text-sm font-medium">
              Día
            </label>
            <Input id="ag-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-10" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ag-time" className="text-sm font-medium">
              Hora
            </label>
            <Input id="ag-time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} required className="h-10" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ag-duration" className="text-sm font-medium">
              Duración (min)
            </label>
            <Input
              id="ag-duration"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(Math.min(720, Number(e.target.value.replace(/\D/g, "")) || 0))}
              className="tabular h-10"
            />
          </div>
        </div>

        {staff.length > 1 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">¿Quién atiende?</p>
            <div className="flex flex-wrap gap-1.5">
              {[{ id: "", name: "Cualquiera" }, ...staff].map((s) => (
                <button
                  key={s.id || "cualquiera"}
                  type="button"
                  onClick={() => setStaffId(s.id)}
                  aria-pressed={staffId === s.id}
                  className={cn("rounded-full border px-3 py-1.5 text-sm", staffId === s.id ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
                >
                  {s.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Nota (opcional)" aria-label="Nota" className="h-10" />

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || duration < 5}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />}
            {a ? "Guardar" : "Agendar"}
          </Button>
        </div>
      </form>
    </AppModal>
  )
}

function AppointmentDetail({
  appointment: a,
  day,
  businessName,
  currency,
  timezone,
  defaultPayment,
  canDelete,
  onEdit,
  onClose,
  onChanged,
}: {
  canDelete: boolean
  appointment: AgendaAppointment
  day: string
  businessName: string
  currency: string
  timezone: string
  defaultPayment: PaymentMethod
  onEdit: () => void
  onClose: () => void
  onChanged: () => void
}) {
  const money = (n: number) => formatMoney(n, currency)
  const [charging, setCharging] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [payment, setPayment] = React.useState<PaymentMethod>(defaultPayment === "FIADO" ? "CASH" : defaultPayment)
  const [pending, startTransition] = React.useTransition()
  const start = clockOf(a.startAt, timezone)
  const end = clockOf(a.endAt, timezone)
  const time = hhmm(start.hour * 60 + start.minute)
  const longDay = dayLabel(day, { weekday: "long", day: "numeric", month: "long" })
  const reminder = appointmentReminderText({ customerName: a.customerName, businessName, serviceName: a.serviceName, dayLabel: longDay.charAt(0).toUpperCase() + longDay.slice(1), time, staffName: a.staffName })

  function status(s: Exclude<AppointmentStatusKey, "DONE">) {
    startTransition(async () => {
      const r = await setAppointmentStatus(a.id, s)
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message)
      onChanged()
    })
  }

  function remove() {
    startTransition(async () => {
      const r = await deleteAppointment(a.id)
      if (!r.ok) return void toast.error(r.message)
      toast.success(`${r.message}: ${a.customerName}, ${time}`)
      onClose()
      onChanged()
    })
  }

  function charge() {
    startTransition(async () => {
      const r = await chargeAppointment(a.id, payment)
      if (!r.ok) return void toast.error(r.message)
      toast.success(`${r.message}: ${money(a.price)}`)
      onClose()
      onChanged()
    })
  }

  return (
    <AppModal open onOpenChange={(o) => !o && onClose()} title={a.customerName} description={`${a.serviceName} · ${money(a.price)}`} noAutoFocus>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-muted-foreground" />
            <span className="first-letter:uppercase">{`${longDay}, ${time} a ${hhmm(end.hour * 60 + end.minute)}`}</span>
          </span>
          {a.staffName ? (
            <span className="flex items-center gap-1.5">
              <UserRound className="size-4 text-muted-foreground" />
              {a.staffName}
            </span>
          ) : null}
          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", APPOINTMENT_STATUS[a.status].tone)}>{APPOINTMENT_STATUS[a.status].label}</span>
          {a.online ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Reservó online</span> : null}
        </div>
        {a.note ? <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">{a.note}</p> : null}

        {a.charged ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
            ✅ Cobrada: quedó como venta en Ventas y en la caja de ese día.
          </p>
        ) : charging ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">¿Cómo te pagó?</p>
            <PaymentChips value={payment} onChange={setPayment} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setCharging(false)} disabled={pending}>
                Volver
              </Button>
              <Button onClick={charge} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Check />}
                Cobrar {money(a.price)}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {(["CONFIRMED", "ARRIVED", "NO_SHOW", "CANCELLED"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending || a.status === s}
                  onClick={() => status(s)}
                  className={cn("rounded-full border px-3 py-1.5 text-sm disabled:opacity-60", a.status === s ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
                >
                  {APPOINTMENT_STATUS[s].label}
                </button>
              ))}
              {a.status === "CANCELLED" || a.status === "NO_SHOW" ? (
                <button type="button" disabled={pending} onClick={() => status("SCHEDULED")} className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted">
                  Volver a agendar
                </button>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="outline" asChild>
                <a
                  href={whatsappLink(a.customerPhone, reminder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void markAppointmentReminded(a.id)}
                >
                  <MessageCircle />
                  {a.reminded ? "Recordar de nuevo" : "Recordar"}
                </a>
              </Button>
              <Button variant="outline" onClick={onEdit} disabled={pending}>
                <Pencil />
                Editar o mover
              </Button>
              <Button onClick={() => setCharging(true)} disabled={pending || a.status === "CANCELLED"}>
                <Check />
                Cobrar
              </Button>
            </div>
            {!a.customerPhone ? <p className="text-xs text-muted-foreground">Sin teléfono: WhatsApp te deja elegir el contacto.</p> : null}
            {canDelete ? (
              confirmDelete ? (
                <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm">
                    ¿Eliminar la cita de <span className="font-medium">{a.customerName}</span>? No se puede deshacer. Si el cliente no vendrá, mejor
                    márcala como cancelada para que quede registro.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={pending}>
                      No, volver
                    </Button>
                    <Button variant="destructive" onClick={remove} disabled={pending}>
                      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
                      Sí, eliminar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={pending}>
                  <Trash2 />
                  Eliminar cita
                </Button>
              )
            ) : null}
          </>
        )}
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
          <X />
          Cerrar
        </Button>
      </div>
    </AppModal>
  )
}

/**
 * Recordar a todos: WhatsApp no deja que una app mande mensajes sola, así que se prepara cada mensaje
 * y la persona solo toca "Enviar" en WhatsApp, una cita tras otra.
 */
function RemindAll({
  appointments,
  day,
  businessName,
  timezone,
  onClose,
}: {
  appointments: AgendaAppointment[]
  day: string
  businessName: string
  timezone: string
  onClose: () => void
}) {
  const [sent, setSent] = React.useState<Set<string>>(() => new Set(appointments.filter((a) => a.reminded).map((a) => a.id)))
  const longDay = dayLabel(day, { weekday: "long", day: "numeric", month: "long" })
  const pendingList = appointments.filter((a) => !sent.has(a.id))
  const next = pendingList[0]

  function textFor(a: AgendaAppointment) {
    const c = clockOf(a.startAt, timezone)
    return appointmentReminderText({
      customerName: a.customerName,
      businessName,
      serviceName: a.serviceName,
      dayLabel: longDay.charAt(0).toUpperCase() + longDay.slice(1),
      time: hhmm(c.hour * 60 + c.minute),
      staffName: a.staffName,
    })
  }

  function markSent(a: AgendaAppointment) {
    setSent((s) => new Set(s).add(a.id))
    void markAppointmentReminded(a.id)
  }

  return (
    <AppModal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Recordar a todos"
      description={`${appointments.length} cita${appointments.length === 1 ? "" : "s"} · ${sent.size} recordada${sent.size === 1 ? "" : "s"}. Toca cada una: se abre WhatsApp con el mensaje listo y solo tocas Enviar.`}
      noAutoFocus
    >
      <div className="space-y-4">
        {next ? (
          <Button asChild size="lg" className="h-12 w-full bg-[#25D366] text-white hover:bg-[#1fb757]">
            <a href={whatsappLink(next.customerPhone, textFor(next))} target="_blank" rel="noopener noreferrer" onClick={() => markSent(next)}>
              <MessageCircle />
              Recordar a {next.customerName.split(" ")[0]} ({hhmm(clockOf(next.startAt, timezone).hour * 60 + clockOf(next.startAt, timezone).minute)})
            </a>
          </Button>
        ) : (
          <p className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
            ✅ ¡Listo! Les recordaste a todos.
          </p>
        )}
        <ul className="divide-y rounded-xl border">
          {appointments.map((a) => {
            const done = sent.has(a.id)
            const c = clockOf(a.startAt, timezone)
            return (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="tabular w-11 shrink-0 font-semibold">{hhmm(c.hour * 60 + c.minute)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.customerName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.customerPhone ? a.serviceName : "Sin teléfono: eliges el contacto en WhatsApp"}</span>
                </span>
                {done ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="size-3.5" />
                    Recordada
                  </span>
                ) : (
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <a href={whatsappLink(a.customerPhone, textFor(a))} target="_blank" rel="noopener noreferrer" onClick={() => markSent(a)}>
                      Enviar
                    </a>
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </AppModal>
  )
}
