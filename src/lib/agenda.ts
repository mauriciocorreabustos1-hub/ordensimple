/** Estados de una cita, con su nombre y color. */
export const APPOINTMENT_STATUS = {
  SCHEDULED: { label: "Agendada", tone: "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100" },
  CONFIRMED: { label: "Confirmada", tone: "border-primary/40 bg-primary/10 text-foreground" },
  ARRIVED: { label: "Llegó", tone: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100" },
  DONE: { label: "Cobrada", tone: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100" },
  NO_SHOW: { label: "No vino", tone: "border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground line-through" },
  CANCELLED: { label: "Cancelada", tone: "border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground line-through" },
} as const

export type AppointmentStatusKey = keyof typeof APPOINTMENT_STATUS

/** Hora y minutos de un instante en la zona del negocio. */
export function clockOf(iso: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return { hour: get("hour"), minute: get("minute") }
}

export const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`

export function durationLabel(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Recordatorio de la cita para mandarle al cliente por WhatsApp. */
export function appointmentReminderText(d: {
  customerName: string
  businessName: string
  serviceName: string
  dayLabel: string
  time: string
  staffName?: string | null
}) {
  const first = d.customerName.split(" ")[0] || d.customerName
  return [
    `📅 ¡Hola, ${first}! Te recordamos tu hora en *${d.businessName}*:`,
    "",
    `✨ ${d.serviceName}`,
    `🗓️ ${d.dayLabel}`,
    `⏰ ${d.time} hrs`,
    d.staffName ? `👤 Te atiende ${d.staffName.split(" ")[0]}` : null,
    "",
    "¿Nos confirmas tu asistencia? ✅",
    "Si necesitas cambiar la hora, avísanos por aquí 🙌",
  ]
    .filter((l) => l !== null)
    .join("\n")
}
