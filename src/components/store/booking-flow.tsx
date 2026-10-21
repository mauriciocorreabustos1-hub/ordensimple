"use client"

import * as React from "react"
import { CalendarCheck, CheckCircle2, Clock, Loader2, UserRound } from "lucide-react"
import { WhatsAppIcon } from "@/components/landing/social-links"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { durationLabel } from "@/lib/agenda"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { whatsappLink } from "@/lib/whatsapp"
import { createBooking, getBookingSlots } from "@/server/actions/booking"

type Service = { id: string; name: string; price: number; durationMin: number }
type Staff = { id: string; name: string }
type Done = { code: string; serviceName: string; staffName: string | null; dayLabel: string; time: string; whatsapp: string; businessName: string }

const dayChip = (day: string, today: string) => {
  const d = new Date(`${day}T12:00:00Z`)
  const tomorrow = new Date(`${today}T12:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const top = day === today ? "Hoy" : day === tomorrow.toISOString().slice(0, 10) ? "Mañana" : new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", weekday: "short" }).format(d).replace(".", "")
  return { top, num: d.getUTCDate(), month: new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", month: "short" }).format(d).replace(".", "") }
}

/** Reserva tu hora: el cliente elige servicio, profesional, día y hora, y deja su nombre y teléfono. */
export function BookingFlow({
  slug,
  businessName,
  currency,
  services,
  staff,
  days,
  today,
}: {
  slug: string
  businessName: string
  currency: string
  services: Service[]
  staff: Staff[]
  days: string[]
  today: string
}) {
  const money = (n: number) => formatMoney(n, currency)
  const [service, setService] = React.useState<Service | null>(services.length === 1 ? services[0] : null)
  const [staffId, setStaffId] = React.useState<string | null>(null)
  const [day, setDay] = React.useState<string | null>(null)
  const [times, setTimes] = React.useState<string[] | null>(null)
  const [loadingTimes, setLoadingTimes] = React.useState(false)
  const [time, setTime] = React.useState<string | null>(null)
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [note, setNote] = React.useState("")
  const [website, setWebsite] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<Done | null>(null)
  const [pending, startTransition] = React.useTransition()
  const formRef = React.useRef<HTMLDivElement>(null)

  async function loadTimes(nextDay: string, s = service, who = staffId) {
    setDay(nextDay)
    setTime(null)
    setTimes(null)
    if (!s) return
    setLoadingTimes(true)
    const r = await getBookingSlots({ slug, productId: s.id, staffId: who, day: nextDay })
    setLoadingTimes(false)
    if (!r.ok || !r.data) return setError(r.message ?? "No pudimos ver las horas.")
    setError(null)
    setTimes(r.data.times)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!service || !day || !time) return
    setError(null)
    startTransition(async () => {
      const r = await createBooking({ slug, productId: service.id, staffId, day, time, customerName: name, customerPhone: phone, note: note || undefined, website: website || undefined })
      if (!r.ok || !r.data) {
        setError(r.message ?? "No se pudo reservar.")
        // Si la hora se ocupó, se muestran las que quedan.
        if (day) void loadTimes(day)
        return
      }
      setDone(r.data)
    })
  }

  if (done) {
    const text = [
      `¡Hola, ${done.businessName}! 👋 Reservé una hora (n.º ${done.code}):`,
      "",
      `✨ ${done.serviceName}`,
      `🗓️ ${done.dayLabel.charAt(0).toUpperCase() + done.dayLabel.slice(1)}`,
      `⏰ ${done.time} hrs`,
      done.staffName ? `👤 Con ${done.staffName}` : null,
      "",
      `A nombre de: ${name.trim()}`,
    ]
      .filter((l) => l !== null)
      .join("\n")
    return (
      <section className="space-y-4 rounded-2xl border bg-background p-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">¡Tu hora quedó reservada!</h2>
          <p className="text-sm text-muted-foreground">
            {done.serviceName} · <span className="first-letter:uppercase">{done.dayLabel}</span> a las {done.time}
            {done.staffName ? ` · con ${done.staffName}` : ""}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Si quieres, avísale por WhatsApp para que te confirme:</p>
        <Button asChild size="lg" className="h-12 w-full bg-[#25D366] text-white hover:bg-[#1fb757]">
          <a href={whatsappLink(done.whatsapp, text)} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon className="size-5" />
            Avisar por WhatsApp
          </a>
        </Button>
      </section>
    )
  }

  const step = (n: number, title: string, children: React.ReactNode, enabled = true) => (
    <div className={cn("space-y-3", !enabled && "pointer-events-none opacity-40")} aria-disabled={!enabled}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>
        {title}
      </p>
      {children}
    </div>
  )

  return (
    <section className="space-y-6 rounded-2xl border bg-background p-4 sm:p-6" aria-labelledby="reserva-titulo">
      <h2 id="reserva-titulo" className="flex items-center gap-2 text-lg font-semibold">
        <CalendarCheck className="size-5 text-primary" />
        Reserva tu hora
      </h2>

      {step(
        1,
        "¿Qué servicio quieres?",
        <ul className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setService(s)
                  if (day) void loadTimes(day, s)
                }}
                aria-pressed={service?.id === s.id}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                  service?.id === s.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted",
                )}
              >
                <span className="min-w-0">
                  <span className="block font-medium">{s.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {durationLabel(s.durationMin)}
                  </span>
                </span>
                <span className="tabular shrink-0 font-semibold">{money(s.price)}</span>
              </button>
            </li>
          ))}
        </ul>,
      )}

      {staff.length > 1
        ? step(
            2,
            "¿Con quién?",
            <div className="flex flex-wrap gap-2">
              {[{ id: null as string | null, name: "Cualquiera" }, ...staff].map((s) => (
                <button
                  key={s.id ?? "cualquiera"}
                  type="button"
                  onClick={() => {
                    setStaffId(s.id)
                    if (day) void loadTimes(day, service, s.id)
                  }}
                  aria-pressed={staffId === s.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                    staffId === s.id ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                  )}
                >
                  <UserRound className="size-3.5" />
                  {s.name}
                </button>
              ))}
            </div>,
            Boolean(service),
          )
        : null}

      {step(
        staff.length > 1 ? 3 : 2,
        "¿Qué día y a qué hora?",
        <div className="space-y-3">
          {days.length ? (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
              {days.map((d) => {
                const c = dayChip(d, today)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => void loadTimes(d)}
                    aria-pressed={day === d}
                    className={cn(
                      "flex min-w-16 shrink-0 flex-col items-center rounded-xl border px-2 py-1.5 text-xs capitalize",
                      day === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span>{c.top}</span>
                    <span className="text-base font-semibold">{c.num}</span>
                    <span className={day === d ? "text-primary-foreground/80" : "text-muted-foreground"}>{c.month}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Por ahora no hay días disponibles.</p>
          )}
          {loadingTimes ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Buscando horas libres…
            </p>
          ) : times ? (
            times.length ? (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {times.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTime(t)
                      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
                    }}
                    aria-pressed={time === t}
                    className={cn(
                      "tabular rounded-lg border py-2 text-sm font-medium",
                      time === t ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50 hover:bg-primary/5",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">No quedan horas libres ese día. Prueba con otro.</p>
            )
          ) : null}
        </div>,
        Boolean(service),
      )}

      <div ref={formRef} className="scroll-mt-4">
        {step(
          staff.length > 1 ? 4 : 3,
          "Tus datos",
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" aria-label="Tu nombre" required minLength={2} maxLength={60} autoComplete="name" className="h-11" />
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Tu teléfono (WhatsApp)" aria-label="Tu teléfono" required inputMode="tel" maxLength={20} autoComplete="tel" className="h-11" />
            </div>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comentario (opcional)" aria-label="Comentario" maxLength={200} className="h-11" />
            {/* Campo trampa para robots (las personas no lo ven). */}
            <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
            {error ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" className="h-12 w-full" disabled={pending || !service || !day || !time}>
              {pending ? <Loader2 className="animate-spin" /> : <CalendarCheck />}
              {service && day && time ? `Reservar ${service.name} · ${dayChip(day, today).top} ${time}` : "Elige servicio, día y hora"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Al reservar, {businessName} recibe tu nombre y teléfono para confirmarte la hora.</p>
          </form>,
          Boolean(service && day && time),
        )}
      </div>
    </section>
  )
}
