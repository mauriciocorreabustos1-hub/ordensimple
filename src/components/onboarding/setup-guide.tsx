"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Loader2, PackagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Logo } from "@/components/app/logo"
import { ProductDialog } from "@/components/products/product-dialog"
import { ServiceDialog } from "@/components/services/service-dialog"
import { SaleDemo, type DemoItem } from "@/components/onboarding/sale-demo"
import { markWelcomeTourSeen } from "@/server/actions/settings"
import { WELCOME_TOUR_SEEN } from "@/components/app/welcome-tour"
import { cn } from "@/lib/utils"

export type GuideFeature = { title: string; text: string; href: string }

type Props = {
  businessId: string
  businessName: string
  currency: string
  /** Cómo se llama lo que vende: productos, platos o servicios. */
  noun: { plural: string; first: string }
  products: { count: number; recent: string[] }
  services: { count: number; recent: string[] } | null
  /** false si el negocio vende solo servicios (sin inventario). */
  sellsProducts: boolean
  categories: string[]
  demoItems: DemoItem[]
  features: GuideFeature[]
  /** Si el plan tiene fiado: la práctica explica la diferencia con la tarjeta de crédito. */
  fiado: boolean
  /** Abierta desde el menú ("Practicar una venta"): solo la práctica, sin tocar el avance de la guía inicial. */
  practice: boolean
}

/** Paso en que va la guía en este equipo: si recarga o vuelve otro día, sigue donde quedó. */
const stepKey = (businessId: string) => `os-primeros-pasos-${businessId}`
const STEPS = ["Tus productos", "Práctica de venta"]

/**
 * Primeros pasos después de crear el negocio: agregar lo que vende y practicar una venta (de práctica, sin guardar).
 * Se muestra sin el menú de la app ([data-foco], ver globals.css) y siempre se puede omitir.
 */
export function SetupGuide(p: Props) {
  const router = useRouter()
  const [step, setStep] = React.useState(p.practice ? 1 : 0)
  const [finished, setFinished] = React.useState(false)
  const [leaving, setLeaving] = React.useState(false)
  const top = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (p.practice) return
    try {
      const saved = localStorage.getItem(stepKey(p.businessId))
      // eslint-disable-next-line react-hooks/set-state-in-effect -- el avance solo existe en el navegador
      if (saved === "venta") setStep(1)
      else if (saved === "listo") {
        setStep(1)
        setFinished(true)
      }
    } catch {}
  }, [p.businessId, p.practice])

  // La práctica repetida desde el menú no cambia el avance de la guía inicial.
  const save = (value: "productos" | "venta" | "listo") => {
    if (p.practice) return
    try {
      localStorage.setItem(stepKey(p.businessId), value)
    } catch {}
  }
  const show = (n: number, done = false) => {
    setStep(n)
    setFinished(done)
    if (!done) save(n === 0 ? "productos" : "venta")
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" })
  }

  async function toBusiness() {
    setLeaving(true)
    if (!p.practice) {
      // Ya aprendió lo principal: el tutorial del Inicio no se abre solo (sigue en el menú, en Cómo usar OrdenSimple).
      window.dispatchEvent(new Event(WELCOME_TOUR_SEEN))
      await markWelcomeTourSeen().catch(() => {})
    }
    router.push("/dashboard")
  }

  const added = p.products.count + (p.services?.count ?? 0)
  const recent = [...p.products.recent, ...(p.services?.recent ?? [])].slice(0, 4)
  const shownSteps = p.practice ? 1 : STEPS.length
  const position = p.practice ? 1 : step + 1
  const progress = finished ? 100 : (position / (shownSteps + 1)) * 100
  const actions = "flex flex-col-reverse gap-2 sm:flex-row sm:items-center"
  // En el celular, los botones de avanzar quedan fijos abajo para tenerlos siempre a mano.
  const mobileBar = "max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-5 max-sm:border-t max-sm:bg-card/95 max-sm:px-5 max-sm:py-3 max-sm:backdrop-blur max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]"

  return (
    <div data-foco ref={top} className="mx-auto w-full max-w-3xl scroll-mt-4 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Logo href="/dashboard" />
        <Button variant="ghost" size="sm" className="min-h-10 text-muted-foreground" onClick={toBusiness} disabled={leaving}>
          {p.practice ? "Salir de la práctica" : "Omitir guía"}
        </Button>
      </div>

      {finished ? null : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {p.practice ? "Práctica de venta" : `Paso ${position} de ${shownSteps}: ${STEPS[step]}`}
          </p>
          <Progress value={progress} className="h-1.5" aria-label={p.practice ? "Práctica de venta" : `Paso ${position} de ${shownSteps}`} />
        </div>
      )}

      <section
        key={`${step}-${finished}`}
        className="animate-in space-y-6 rounded-2xl border bg-card p-5 shadow-sm duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none sm:p-8"
      >
        {step === 0 ? (
          <>
            <header className="space-y-1.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Agrega tus primeros {p.noun.plural}</h1>
              <p className="text-pretty text-muted-foreground">
                {p.businessName} ya está creado. Agrega lo que vendes con su precio, y así cada venta queda anotada con su detalle. Puedes agregar más
                después.
              </p>
            </header>

            <div className="flex flex-wrap gap-2">
              {p.sellsProducts ? <ProductDialog currency={p.currency} categories={p.categories} /> : null}
              {p.services ? <ServiceDialog currency={p.currency} /> : null}
            </div>

            {added ? (
              <div className="rounded-xl border bg-success/5 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="size-4 text-success" aria-hidden />
                  Ya tienes {added} {added === 1 ? "agregado" : "agregados"}
                </p>
                <p className="mt-1 text-muted-foreground">{recent.join(", ")}</p>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                <PackagePlus className="mt-0.5 size-5 shrink-0" aria-hidden />
                <p>
                  Empieza con {p.noun.first}. Si prefieres hacerlo después, toca <strong>Omitir por ahora</strong>: también puedes anotar ventas solo con
                  el monto.
                </p>
              </div>
            )}

            <div className={cn(actions, "sm:justify-end", mobileBar)}>
              {added ? null : (
                <Button variant="ghost" className="min-h-11 w-full sm:w-auto" onClick={() => show(1)}>
                  Omitir por ahora
                </Button>
              )}
              <Button size="lg" className="h-11 w-full px-5 sm:w-auto" onClick={() => show(1)} variant={added ? "default" : "outline"}>
                Continuar
                <ArrowRight />
              </Button>
            </div>
          </>
        ) : finished ? (
          <>
            <header className="space-y-2 text-center">
              <span className="mx-auto flex size-14 animate-in items-center justify-center rounded-full bg-success/15 text-success duration-500 zoom-in-75 motion-reduce:animate-none">
                <CheckCircle2 className="size-7" aria-hidden />
              </span>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">¡Ya estás listo para comenzar!</h1>
              <p className="text-pretty text-muted-foreground">Aprendiste a registrar una venta. Ahora puedes comenzar a administrar tu negocio con OrdenSimple.</p>
            </header>

            <ul className="mx-auto max-w-md divide-y rounded-xl border text-sm">
              <li className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
                <span>
                  <span className="font-medium">Negocio configurado</span>
                  <span className="block text-muted-foreground">{p.businessName}</span>
                </span>
              </li>
              <li className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
                <span>
                  <span className="font-medium">Práctica completada</span>
                  <span className="block text-muted-foreground">No se guardó ninguna venta.</span>
                </span>
              </li>
              <li className="flex items-center gap-3 px-4 py-3">
                <Circle className="size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-medium">Próximo paso: registrar tu primera venta real</span>
                  <span className="block text-muted-foreground">Con el botón verde Registrar venta, en tu Inicio.</span>
                </span>
              </li>
            </ul>

            {p.features.length ? (
              <div className="space-y-3">
                <h2 className="font-semibold">Lo que más te va a servir</h2>
                <ul className="grid gap-2 sm:grid-cols-3">
                  {p.features.map((f) => (
                    <li key={f.href}>
                      <Link href={f.href} className="block h-full rounded-xl border p-3 transition-colors hover:border-primary/50">
                        <span className="block text-sm font-medium">{f.title}</span>
                        <span className="block text-xs text-muted-foreground">{f.text}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className={cn(actions, "sm:justify-between", mobileBar)}>
              <Button variant="ghost" className="min-h-11 w-full sm:w-auto" onClick={() => show(1)} disabled={leaving}>
                Practicar otra vez
              </Button>
              <Button size="lg" className="h-11 w-full px-5 sm:w-auto" onClick={toBusiness} disabled={leaving}>
                {leaving ? <Loader2 className="animate-spin" /> : null}
                Ir a mi negocio
                {leaving ? null : <ArrowRight />}
              </Button>
            </div>
          </>
        ) : (
          <>
            <header className="space-y-1.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Aprende a registrar una venta</h1>
              <p className="text-pretty text-muted-foreground">Sigue los 4 pasos. Así se anota una venta en OrdenSimple.</p>
            </header>
            <SaleDemo
              items={p.demoItems}
              currency={p.currency}
              fiado={p.fiado}
              onDone={() => {
                save("listo")
                show(1, true)
              }}
            />
            {p.practice ? null : (
              <div className={cn(actions, "sm:justify-between")}>
                <Button variant="ghost" className="min-h-11 w-full sm:w-auto" onClick={() => show(0)}>
                  <ArrowLeft />
                  Volver a tus productos
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
