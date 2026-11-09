"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, Circle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQuickActions } from "@/components/app/quick-actions"
import { cn } from "@/lib/utils"

export type FirstStep = { key: string; label: string; hint: string; done: boolean; href?: string; action?: "sale" | "expense" }

const HIDE_KEY = "primeros-pasos-oculto"
const CONGRATS_KEY = "primeros-pasos-felicitado"

/** "Primeros pasos": lo mínimo para que el negocio quede andando. Desaparece al completarlo o al ocultarlo. */
export function FirstSteps({ businessId, steps, fresh = false }: { businessId: string; steps: FirstStep[]; fresh?: boolean }) {
  const { open } = useQuickActions()
  const [hidden, setHidden] = React.useState(false)
  const [congratulated, setCongratulated] = React.useState(true)
  React.useEffect(() => {
    try {
      // Se lee después de montar para que el servidor y el navegador dibujen lo mismo la primera vez.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(HIDE_KEY) === businessId) setHidden(true)
      setCongratulated(localStorage.getItem(CONGRATS_KEY) === businessId)
    } catch {}
  }, [businessId])

  const done = steps.filter((s) => s.done).length
  if (hidden) return null
  // Al completar todo: una felicitación chica, una sola vez, y después deja de ocupar espacio.
  if (done === steps.length) {
    // Solo a negocios nuevos: a quien terminó hace tiempo no se le muestra de repente.
    if (congratulated || !fresh) return null
    return (
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 p-4 text-sm">
        <CheckCircle2 className="size-5 shrink-0 text-success" />
        <p className="flex-1">
          <span className="font-semibold">¡Tu negocio está listo!</span> Completaste los primeros pasos. Desde ahora, todo lo que anotes se ve en
          tus números.
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Cerrar felicitación"
          onClick={() => {
            setCongratulated(true)
            try {
              localStorage.setItem(CONGRATS_KEY, businessId)
            } catch {}
          }}
        >
          <X />
        </Button>
      </div>
    )
  }

  return (
    <section aria-labelledby="primeros-pasos" className="space-y-3 rounded-2xl border bg-card p-4 shadow-xs md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="primeros-pasos" className="font-display text-lg font-semibold tracking-tight">
            Primeros pasos
          </h2>
          <p className="text-sm text-muted-foreground">
            Llevas {done} de {steps.length}. Con esto tus números empiezan a tener sentido.{" "}
            <Link href="/dashboard/primeros-pasos" className="font-medium text-primary hover:underline">
              Practicar una venta de ejemplo
            </Link>
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
      <ol className="grid gap-x-4 sm:grid-cols-2">
        {steps.map((s) => {
          const body = (
            <>
              {s.done ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <Circle className="size-5 shrink-0 text-muted-foreground" />}
              <span className="min-w-0">
                <span className={cn("block text-sm font-medium", s.done && "text-muted-foreground")}>{s.label}</span>
                <span className={cn("block text-xs", s.done ? "text-success" : "text-muted-foreground")}>{s.done ? "¡Listo!" : s.hint}</span>
              </span>
            </>
          )
          const cls = cn("-mx-2 flex h-full w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2.5 text-left", !s.done && "transition-colors hover:bg-muted")
          return (
            // Si el último queda solo en su fila, ocupa todo el ancho.
            <li key={s.key} className="sm:[&:last-child:nth-child(odd)]:col-span-2">
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
