import { Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"

/** Bloque "¿Qué significa esto?" para traducir conceptos a lenguaje simple. */
export function Explainer({
  title = "¿Qué significa esto?",
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex gap-3 rounded-xl border border-primary/20 bg-accent/60 p-4 text-sm", className)}>
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="space-y-1">
        <p className="font-medium text-accent-foreground">{title}</p>
        <div className="leading-relaxed text-foreground/80">{children}</div>
      </div>
    </div>
  )
}
