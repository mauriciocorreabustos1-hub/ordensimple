"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, Circle, Rocket, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQuickActions } from "@/components/app/quick-actions"
import { cn } from "@/lib/utils"

export type FirstStep = { key: string; label: string; hint: string; done: boolean; href?: string; action?: "sale" | "expense" }

const HIDE_KEY = "primeros-pasos-oculto"

/** "Primeros pasos": lo mínimo para que el negocio quede andando. Desaparece al completarlo o al ocultarlo. */
export function FirstSteps({ businessId, steps }: { businessId: string; steps: FirstStep[] }) {
  const { open } = useQuickActions()
  const [hidden, setHidden] = React.useState(false)
  React.useEffect(() => {
    try {
      // Se lee después de montar para que el servidor y el navegador dibujen lo mismo la primera vez.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(HIDE_KEY) === businessId) setHidden(true)
    } catch {}
  }, [businessId])

  const done = steps.filter((s) => s.done).length
  if (hidden || done === steps.length) return null

  return (
    <section aria-labelledby="primeros-pasos" className="space-y-3 rounded-2xl border border-primary/30 bg-accent/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="primeros-pasos" className="flex items-center gap-2 font-semibold">
            <Rocket className="size-4 text-primary" />
            Primeros pasos
          </h2>
          <p className="text-sm text-muted-foreground">
            Llevas {done} de {steps.length}. Con esto tus números empiezan a tener sentido.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ocultar primeros pasos"
          onClick={() => {
            setHidden(true)
            try {
              localStorage.setItem(HIDE_KEY, businessId)
            } catch {}
          }}
        >
          <X />
        </Button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-2 sm:grid-cols-2">
        {steps.map((s) => {
          const body = (
            <>
              {s.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
              <span className="min-w-0">
                <span className={cn("block text-sm font-medium", s.done && "text-muted-foreground line-through")}>{s.label}</span>
                {s.done ? null : <span className="block text-xs text-muted-foreground">{s.hint}</span>}
              </span>
            </>
          )
          const cls = cn("flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left", !s.done && "transition-colors hover:border-primary/50")
          return (
            <li key={s.key}>
              {s.done ? (
                <div className={cls}>{body}</div>
              ) : s.action ? (
                <button type="button" className={cls} onClick={() => open(s.action!)}>
                  {body}
                </button>
              ) : (
                <Link href={s.href ?? "/dashboard"} className={cls}>
                  {body}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
