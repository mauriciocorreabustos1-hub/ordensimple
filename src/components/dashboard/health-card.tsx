import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react"
import type { Health } from "@/lib/calculations"
import { cn } from "@/lib/utils"

const STYLES = {
  good: { icon: CheckCircle2, emoji: "🟢", box: "border-success/30 bg-success/10", iconColor: "text-success" },
  warning: { icon: AlertTriangle, emoji: "🟡", box: "border-warning/40 bg-warning/10", iconColor: "text-warning" },
  bad: { icon: XCircle, emoji: "🔴", box: "border-danger/30 bg-danger/10", iconColor: "text-danger" },
  empty: { icon: CircleDashed, emoji: "⚪", box: "border-dashed bg-muted/40", iconColor: "text-muted-foreground" },
} as const

export function HealthCard({ health }: { health: Health }) {
  const s = STYLES[health.status]
  return (
    <section aria-label="¿Cómo va tu negocio?" className={cn("flex gap-3 rounded-2xl border p-4 md:p-5", s.box)}>
      <s.icon className={cn("mt-0.5 size-5 shrink-0", s.iconColor)} aria-hidden />
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-muted-foreground">¿Cómo va tu negocio?</p>
        <p className="font-semibold">
          <span className="mr-1.5" aria-hidden>
            {s.emoji}
          </span>
          {health.title}
        </p>
        <p className="text-sm text-foreground/80">{health.message}</p>
      </div>
    </section>
  )
}
