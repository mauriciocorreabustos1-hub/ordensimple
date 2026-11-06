"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Plus, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppModal } from "@/components/app/app-modal"
import { usePlanFlags } from "@/components/app/quick-actions"
import { cn } from "@/lib/utils"
import { markWelcomeTourSeen } from "@/server/actions/settings"
import { GUIDE_START } from "@/components/app/guided-tour"

/** Evento para abrir el tutorial desde el menú ("Cómo usar OrdenSimple"). */
export const OPEN_WELCOME_TOUR = "abrir-tutorial"
/** Evento de los primeros pasos: la persona ya practicó una venta, así que el tutorial no se abre solo. */
export const WELCOME_TOUR_SEEN = "tutorial-visto"

const STEPS = [
  {
    time: "08:30",
    title: "Abres y ves cómo vas",
    text: "En Inicio está la cuenta del día: lo que vendiste, lo que gastaste y lo que te quedó. Sin planillas.",
    sample: (
      <dl className="grid w-56 grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Vendiste</dt>
        <dd className="tabular text-right font-semibold">$350.000</dd>
        <dt className="text-muted-foreground">Gastaste</dt>
        <dd className="tabular text-right font-semibold">
          <span className="mr-1 font-normal text-muted-foreground">−</span>$120.000
        </dd>
        <dt className="pt-1.5 font-semibold">Te quedó</dt>
        <dd className="tabular border-t-2 border-foreground/70 pt-1.5 text-right text-lg font-semibold text-success">$230.000</dd>
      </dl>
    ),
  },
  {
    time: "13:00",
    title: "Cada venta, en segundos",
    text: "Toca el botón verde y escribe solo el monto. Si tienes productos, escanea su código con la cámara del celular.",
    sample: (
      <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground shadow-sm">
        <Plus className="size-4" />
        Registrar venta
      </span>
    ),
  },
  {
    time: "17:00",
    title: "¿Pagaste algo? Anótalo",
    text: "La luz, el arriendo o una compra a un proveedor van en Registrar gasto. Si escribes el proveedor, se crea su ficha.",
    sample: (
      <span className="inline-flex h-11 items-center gap-2 rounded-lg border bg-card px-5 font-medium shadow-xs">
        <Receipt className="size-4 text-chart-2" />
        Registrar gasto
      </span>
    ),
  },
  {
    time: "21:00",
    title: "Cierras la caja en un minuto",
    text: "En Cierre de caja cuentas el dinero y te dice si cuadra. Y cada lunes te llega al correo el resumen de tu semana.",
    sample: (
      <span className="-rotate-6 rounded border-2 border-primary px-3 py-1 font-mono text-sm font-bold tracking-wide text-primary">
        CUADRA ✓
      </span>
    ),
  },
] as const

/**
 * Tutorial de bienvenida: el primer día con OrdenSimple, de la mañana al cierre, mostrando el botón real que
 * hay que buscar en cada momento. Se abre solo la primera vez (`show`) y desde el menú cuando la persona quiera.
 */
export function WelcomeTour({ show }: { show: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState(0)
  const marked = React.useRef(!show)

  React.useEffect(() => {
    const seen = () => {
      marked.current = true
    }
    window.addEventListener(WELCOME_TOUR_SEEN, seen)
    return () => window.removeEventListener(WELCOME_TOUR_SEEN, seen)
  }, [])

  // Se abre solo en el Inicio (no encima del pago si llegó a pagar un plan, por ejemplo).
  React.useEffect(() => {
    if (!marked.current && pathname === "/dashboard") setOpen(true)
  }, [pathname])

  React.useEffect(() => {
    const reopen = () => {
      setStep(0)
      setOpen(true)
    }
    window.addEventListener(OPEN_WELCOME_TOUR, reopen)
    return () => window.removeEventListener(OPEN_WELCOME_TOUR, reopen)
  }, [])

  function close() {
    setOpen(false)
    if (!marked.current) {
      marked.current = true
      void markWelcomeTourSeen()
    }
  }

  const plan = usePlanFlags()
  const s = STEPS[step]
  // En Gratis, el cierre de caja es de Pro: el paso lo dice.
  const text = s.time === "21:00" && !plan.cashClose ? `Con el plan Pro, ${s.text.charAt(0).toLowerCase()}${s.text.slice(1)}` : s.text
  const last = step === STEPS.length - 1

  return (
    <AppModal open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} title="Tu primer día con OrdenSimple">
      <div className="grid gap-6">
        {/* El día, de la mañana al cierre: cada hora es un paso. */}
        <ol className="grid grid-cols-4 border-t">
          {STEPS.map((x, i) => (
            <li key={x.time}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "tabular -mt-px w-full border-t-2 pt-2 text-left text-xs transition-colors",
                  i === step ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {x.time}
              </button>
            </li>
          ))}
        </ol>

        <div className="space-y-2">
          <p className="font-display text-2xl font-semibold tracking-tight">{s.title}</p>
          <p className="text-pretty text-muted-foreground">{text}</p>
        </div>

        <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed bg-muted/40 p-5" aria-hidden>
          {s.sample}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={close} className="text-muted-foreground">
            {last ? "Ir al Inicio" : "Saltar"}
          </Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="flex-1 sm:flex-none">
                Atrás
              </Button>
            ) : null}
            {last ? (
              <Button
                type="button"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  close()
                  window.dispatchEvent(new Event(GUIDE_START))
                }}
              >
                Hagámoslo juntos
              </Button>
            ) : (
              <Button type="button" onClick={() => setStep(step + 1)} className="flex-1 sm:flex-none">
                Siguiente
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppModal>
  )
}
