"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, PackagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ProductDialog } from "@/components/products/product-dialog"
import { ServiceDialog } from "@/components/services/service-dialog"
import { SaleDemo, type DemoItem } from "@/components/onboarding/sale-demo"
import { markWelcomeTourSeen } from "@/server/actions/settings"
import { WELCOME_TOUR_SEEN } from "@/components/app/welcome-tour"

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
}

/** Paso en que va la guía en este equipo: si recarga o vuelve otro día, sigue donde quedó. */
const stepKey = (businessId: string) => `os-primeros-pasos-${businessId}`
const STEPS = ["Tus productos", "Tu primera venta"]

/** Primeros pasos después de crear el negocio: agregar lo que vende y practicar una venta (de ejemplo, sin guardar). */
export function SetupGuide(p: Props) {
  const router = useRouter()
  const [step, setStep] = React.useState(0)
  const [finished, setFinished] = React.useState(false)
  const [leaving, setLeaving] = React.useState(false)

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(stepKey(p.businessId))
      // eslint-disable-next-line react-hooks/set-state-in-effect -- el avance solo existe en el navegador
      if (saved === "venta") setStep(1)
      else if (saved === "listo") {
        setStep(1)
        setFinished(true)
      }
    } catch {}
  }, [p.businessId])

  const save = (value: "productos" | "venta" | "listo") => {
    try {
      localStorage.setItem(stepKey(p.businessId), value)
    } catch {}
  }
  const go = (n: number) => {
    setStep(n)
    setFinished(false)
    save(n === 0 ? "productos" : "venta")
  }

  async function toBusiness() {
    setLeaving(true)
    // Ya aprendió lo principal: el tutorial del Inicio no se abre solo (sigue en el menú, en Cómo usar OrdenSimple).
    window.dispatchEvent(new Event(WELCOME_TOUR_SEEN))
    await markWelcomeTourSeen().catch(() => {})
    router.push("/dashboard")
  }

  const added = p.products.count + (p.services?.count ?? 0)
  const recent = [...p.products.recent, ...(p.services?.recent ?? [])].slice(0, 4)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Paso {step + 1} de {STEPS.length}: {STEPS[step]}
        </p>
        <Progress value={finished ? 100 : ((step + 1) / (STEPS.length + 1)) * 100} className="h-1.5" aria-label={`Paso ${step + 1} de ${STEPS.length}`} />
      </div>

      <section key={`${step}-${finished}`} className="animate-in space-y-6 rounded-2xl border bg-card p-5 shadow-sm duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none sm:p-8">
        {step === 0 ? (
          <>
            <header className="space-y-1.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Agrega tus primeros {p.noun.plural}</h1>
              <p className="text-pretty text-muted-foreground">
                {p.businessName} ya está creado. Agrega lo que vendes con su precio, y así cada venta queda anotada con su detalle. Puedes
                agregar más después.
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
                  Empieza con {p.noun.first}. Si prefieres hacerlo después, toca <strong>Omitir por ahora</strong>: también puedes anotar ventas
                  solo con el monto.
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {added ? null : (
                <Button variant="ghost" className="w-full sm:w-auto" onClick={() => go(1)}>
                  Omitir por ahora
                </Button>
              )}
              <Button size="lg" className="h-11 w-full px-5 sm:w-auto" onClick={() => go(1)} variant={added ? "default" : "outline"}>
                Continuar
                <ArrowRight />
              </Button>
            </div>
          </>
        ) : finished ? (
          <>
            <header className="space-y-2 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="size-7" aria-hidden />
              </span>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">¡Excelente! Ya sabes cómo registrar tu primera venta.</h1>
              <p className="text-pretty text-muted-foreground">
                En tu negocio, las ventas se anotan con el botón verde <strong>Registrar venta</strong>. Esa venta de práctica no quedó guardada.
              </p>
            </header>

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

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="ghost" className="w-full sm:w-auto" onClick={() => go(1)} disabled={leaving}>
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
              <p className="text-pretty text-muted-foreground">Así se anota una venta en OrdenSimple. Prueba con estos productos de ejemplo.</p>
            </header>
            <SaleDemo
              items={p.demoItems}
              currency={p.currency}
              onDone={() => {
                setFinished(true)
                save("listo")
              }}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="ghost" className="w-full sm:w-auto" onClick={() => go(0)}>
                <ArrowLeft />
                Atrás
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground sm:w-auto" onClick={toBusiness} disabled={leaving}>
                Omitir e ir a mi negocio
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
