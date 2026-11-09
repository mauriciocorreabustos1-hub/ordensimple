import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react"
import type { Health } from "@/lib/calculations"
import { cn } from "@/lib/utils"

const STYLES = {
  good: { icon: CheckCircle2, iconColor: "text-success" },
  warning: { icon: AlertTriangle, iconColor: "text-warning" },
  bad: { icon: XCircle, iconColor: "text-danger" },
  empty: { icon: CircleDashed, iconColor: "text-muted-foreground" },
} as const

export function HealthCard({ health }: { health: Health }) {
  const s = STYLES[health.status]
  return (
    <section aria-label="¿Cómo va tu negocio?" className="flex items-start gap-2.5 rounded-xl border bg-card px-4 py-3 text-sm">
      <s.icon className={cn("mt-0.5 size-4 shrink-0", s.iconColor)} aria-hidden />
      <p className="text-pretty">
        <strong className="font-semibold">{health.title}.</strong> <span className="text-muted-foreground">{health.message}</span>
      </p>
    </section>
  )
}
