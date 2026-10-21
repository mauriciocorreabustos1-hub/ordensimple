import { BellRing, CalendarCheck, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

// Dibujo de la agenda del día y de una reserva hecha por internet (datos de ejemplo).

const APPOINTMENTS = [
  { time: "10:00", client: "Camila R.", service: "Corte y brushing", who: "Valentina", state: "Llegó", tone: "bg-emerald-100 text-emerald-800" },
  { time: "11:30", client: "Jorge M.", service: "Corte de pelo", who: "Matías", state: "Confirmada", tone: "bg-sky-100 text-sky-800" },
  { time: "12:00", client: "Fernanda S.", service: "Manicure", who: "Valentina", state: "Online", tone: "bg-violet-100 text-violet-800" },
  { time: "15:30", client: "Andrea P.", service: "Tintura", who: "Valentina", state: "Agendada", tone: "bg-muted text-muted-foreground" },
]

export function AgendaPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[34rem]", className)} aria-hidden>
      {/* La agenda del día */}
      <div className="relative z-10 w-[94%] rotate-1 rounded-2xl border bg-card p-4 shadow-xl sm:w-[88%] sm:p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-xl font-semibold">Hoy, martes</p>
          <span className="text-xs text-muted-foreground">4 citas · $58.000</span>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {APPOINTMENTS.map((a) => (
            <li key={a.time} className="flex items-center gap-3 rounded-xl border px-3 py-2">
              <span className="tabular w-11 shrink-0 font-semibold">{a.time}</span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-medium">{a.client}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {a.service} · {a.who}
                </span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", a.tone)}>{a.state}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* La reserva que hizo un cliente desde la página del negocio */}
      <div className="relative z-20 -mt-6 w-[76%] -rotate-1 rounded-2xl border-2 border-primary/40 bg-card p-3.5 shadow-2xl sm:-mt-8 sm:w-[58%]">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <BellRing className="size-3.5" />
          Reserva nueva por internet
        </p>
        <p className="mt-1.5 text-sm font-semibold">Fernanda S. · Manicure</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          Hoy 12:00 con Valentina · 45 min
        </p>
        <span className="mt-2.5 flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
          <CalendarCheck className="size-3.5" />
          Ya está en tu agenda
        </span>
      </div>
    </div>
  )
}
