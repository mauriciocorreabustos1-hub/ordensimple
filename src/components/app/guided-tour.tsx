"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

/** Eventos que avisan a la guía: empezar, y que se guardó una venta o un gasto. */
export const GUIDE_START = "os:guia-iniciar"
export const GUIDE_SALE_SAVED = "os:venta-guardada"
export const GUIDE_EXPENSE_SAVED = "os:gasto-guardado"

/** Paso actual de la guía en este equipo (si recarga la página, sigue donde iba). */
const KEY = "os-guia-paso"

type Step = {
  /** Elemento que se ilumina (atributo data-tour). */
  target: string
  title: string
  text: string
  /** Texto si el elemento no se ve (por ejemplo, el menú en el celular). */
  hidden?: string
  /** Cómo se completa: guardar algo, ir a una página o tocar "Entendido". */
  doneOn: { event: string } | { path: string } | "ok"
  /** Página donde está el elemento. */
  page: string
}

const STEPS: Step[] = [
  {
    target: "registrar-venta",
    title: "Anota tu primera venta",
    text: "Toca Registrar venta, escribe el monto y guarda. Puede ser una de prueba: después la puedes borrar en Ventas.",
    doneOn: { event: GUIDE_SALE_SAVED },
    page: "/dashboard",
  },
  {
    target: "registrar-gasto",
    title: "Ahora anota un gasto",
    text: "Toca Registrar gasto: por ejemplo la luz, el arriendo o una compra a un proveedor.",
    doneOn: { event: GUIDE_EXPENSE_SAVED },
    page: "/dashboard",
  },
  {
    target: "cuenta-hoy",
    title: "Mira tu cuenta",
    text: "Aquí ves lo que vendiste, lo que gastaste y lo que te quedó hoy. Se actualiza sola cada vez que anotas algo.",
    doneOn: "ok",
    page: "/dashboard",
  },
  {
    target: "menu-reportes",
    title: "Tus reportes",
    text: "En Reportes ves cómo te va en el mes, con gráficos y lo que más vendes. Tócalo para terminar.",
    hidden: "En el celular: toca Más (abajo a la derecha) y luego Reportes.",
    doneOn: { path: "/dashboard/reportes" },
    page: "/dashboard",
  },
]

/** El elemento visible con ese data-tour (puede haber uno escondido, como el menú del celular). */
function findTarget(name: string) {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`))
  return all.find((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  })
}

/**
 * Guía práctica: ilumina el botón que hay que usar (el resto se oscurece) y explica qué hacer. Avanza sola
 * cuando la persona guarda una venta, un gasto o abre Reportes. No bloquea nada: se puede cerrar cuando quiera.
 */
export function GuidedTour() {
  const pathname = usePathname()
  const [step, setStep] = React.useState<number | null>(null)
  const [rect, setRect] = React.useState<DOMRect | null>(null)

  // Retomar donde iba (si recargó la página a mitad de la guía).
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved !== null) setStep(Number(saved))
    } catch {}
    const start = () => setStep(0)
    window.addEventListener(GUIDE_START, start)
    return () => window.removeEventListener(GUIDE_START, start)
  }, [])

  React.useEffect(() => {
    try {
      if (step === null) localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, String(step))
    } catch {}
  }, [step])

  const current = step !== null ? STEPS[step] : null

  const advance = React.useCallback(() => {
    setStep((s) => {
      if (s === null) return null
      if (s + 1 >= STEPS.length) {
        toast.success("¡Listo! Ya sabes lo básico de OrdenSimple.")
        return null
      }
      return s + 1
    })
  }, [])

  // Avanzar cuando se guarda la venta o el gasto.
  React.useEffect(() => {
    if (!current || typeof current.doneOn !== "object" || !("event" in current.doneOn)) return
    const name = current.doneOn.event
    window.addEventListener(name, advance)
    return () => window.removeEventListener(name, advance)
  }, [current, advance])

  // Avanzar (o terminar) al abrir la página indicada.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current && typeof current.doneOn === "object" && "path" in current.doneOn && pathname === current.doneOn.path) advance()
  }, [current, pathname, advance])

  // Ubicar el elemento iluminado (y seguirlo si la página se mueve o cambia de tamaño).
  React.useEffect(() => {
    if (!current) return
    let frame = 0
    let scrolled = false
    const update = () => {
      const el = findTarget(current.target)
      if (el && !scrolled) {
        scrolled = true
        el.scrollIntoView({ block: "center", behavior: "smooth" })
      }
      setRect(el ? el.getBoundingClientRect() : null)
      frame = window.setTimeout(update, 250)
    }
    update()
    return () => window.clearTimeout(frame)
  }, [current, pathname])

  if (!current || step === null) return null

  const close = () => setStep(null)
  const pad = 8
  const onPage = pathname === current.page
  // Burbuja bajo el elemento, o arriba si no cabe.
  const below = rect ? rect.bottom + 180 < window.innerHeight : true
  const bubbleTop = rect ? (below ? rect.bottom + pad + 10 : Math.max(12, rect.top - pad - 10 - 170)) : undefined
  const bubbleLeft = rect ? Math.min(Math.max(12, rect.left), window.innerWidth - 332) : undefined

  return (
    <>
      {rect ? (
        // Cuatro franjas oscuras alrededor del elemento (lo demás se oscurece) y un borde verde en el hueco.
        // No capturan toques: la persona puede usar la app normalmente.
        <div aria-hidden className="pointer-events-none fixed inset-0 z-40">
          {[
            { top: 0, left: 0, right: 0, height: Math.max(0, rect.top - pad) },
            { top: rect.bottom + pad, left: 0, right: 0, bottom: 0 },
            { top: rect.top - pad, left: 0, width: Math.max(0, rect.left - pad), height: rect.height + pad * 2 },
            { top: rect.top - pad, left: rect.right + pad, right: 0, height: rect.height + pad * 2 },
          ].map((style, i) => (
            <div key={i} className="absolute bg-black/50" style={style} />
          ))}
          <div
            className="absolute rounded-2xl ring-2 ring-primary"
            style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
          />
        </div>
      ) : null}
      <div
        role="dialog"
        aria-live="polite"
        aria-label={`Guía, paso ${step + 1} de ${STEPS.length}`}
        className="fixed z-40 w-[320px] max-w-[calc(100vw-24px)] space-y-3 rounded-2xl border bg-card p-4 shadow-xl"
        style={rect ? { top: bubbleTop, left: bubbleLeft } : { left: "50%", bottom: 96, transform: "translateX(-50%)" }}
      >
        <p className="text-xs font-medium text-muted-foreground">
          Paso {step + 1} de {STEPS.length}
        </p>
        <p className="font-display text-lg leading-snug font-semibold">{current.title}</p>
        <p className="text-sm text-pretty text-muted-foreground">{rect ? current.text : onPage ? (current.hidden ?? current.text) : current.text}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={close} className="text-muted-foreground">
            Salir de la guía
          </Button>
          {!onPage && !rect ? (
            <Button size="sm" asChild>
              <Link href={current.page}>Ir al Inicio</Link>
            </Button>
          ) : current.doneOn === "ok" ? (
            <Button type="button" size="sm" onClick={advance}>
              Entendido
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={advance}>
              Saltar paso
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
