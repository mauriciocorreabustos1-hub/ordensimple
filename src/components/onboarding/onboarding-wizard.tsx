"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, Briefcase, Hammer, Loader2, Plus, Scissors, Shirt, Store, UtensilsCrossed } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field } from "@/components/app/field"
import { COUNTRIES } from "@/lib/constants"
import { BusinessTypePicker } from "@/components/app/business-type-picker"
import { CURRENCIES, CURRENCY_CODES } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { OnboardingInput } from "@/lib/validations"
import { completeOnboarding } from "@/server/actions/onboarding"

type State = Required<Pick<OnboardingInput, "name" | "country" | "currency">> & OnboardingInput

/** Los rubros más comunes, como tarjetas. Cada uno guarda el mismo texto que usa el resto de la app (ver business-kind). */
const RUBROS = [
  { value: "Almacén o minimarket", label: "Almacén o minimarket", hint: "Productos, stock y fiado", icon: Store },
  { value: "Restaurante, café o comida", label: "Restaurante o cafetería", hint: "Platos, comandas y mesas", icon: UtensilsCrossed },
  { value: "Belleza y estética", label: "Peluquería o barbería", hint: "Servicios, horas y clientes", icon: Scissors },
  { value: "Ferretería o construcción", label: "Ferretería", hint: "Códigos de barras y stock", icon: Hammer },
  { value: "Tienda de ropa o accesorios", label: "Tienda de ropa", hint: "Tallas, colores y temporadas", icon: Shirt },
  { value: "Servicios profesionales", label: "Servicios profesionales", hint: "Clientes y cotizaciones", icon: Briefcase },
] as const

const STEPS = [
  { title: "¡Bienvenido a OrdenSimple!", description: "Vamos a preparar tu negocio en unos simples pasos para que puedas comenzar a vender y mantener todo bajo control." },
  { title: "¿Qué tipo de negocio tienes?", description: "Así te mostramos ejemplos de tu rubro. Igual puedes usar todas las funciones." },
  { title: "Los datos de tu negocio", description: "Solo lo necesario. Lo puedes cambiar cuando quieras en Configuración." },
]

/** Lo que lleva avanzado se guarda en este equipo: si cierra la página, sigue donde quedó. */
const draftKey = (userId: string) => `os-configuracion-${userId}`

export function OnboardingWizard({ userId, firstName, planChoice }: { userId: string; firstName: string; planChoice?: string }) {
  // Si ya eligió Pro o Empresa para pagar, solo se pide el nombre del negocio y va directo al pago (Chile y pesos
  // por defecto); lo demás se completa después en Configuración.
  const first = planChoice ? 2 : 0
  const [step, setStep] = React.useState(first)
  const [pending, setPending] = React.useState(false)
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [otherOpen, setOtherOpen] = React.useState(false)
  const [data, setData] = React.useState<State>({ name: "", country: "CL", currency: "CLP" })
  // El borrador se guarda solo después de leerlo, para no pisarlo con el formulario vacío.
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey(userId)) ?? "null") as { step?: number; data?: Partial<State> } | null
      if (saved?.data) {
        const d = saved.data
        const type = typeof d.type === "string" ? d.type.slice(0, 200) : undefined
        // eslint-disable-next-line react-hooks/set-state-in-effect -- el borrador solo existe en el navegador
        setData((cur) => ({
          ...cur,
          name: typeof d.name === "string" ? d.name.slice(0, 80) : cur.name,
          country: COUNTRIES.some((c) => c.code === d.country) ? d.country! : cur.country,
          currency: typeof d.currency === "string" && (CURRENCY_CODES as readonly string[]).includes(d.currency) ? d.currency : cur.currency,
          type,
        }))
        if (type && !RUBROS.some((r) => r.value === type)) setOtherOpen(true)
        if (!planChoice && typeof saved.step === "number") setStep(Math.min(Math.max(0, saved.step), STEPS.length - 1))
      }
    } catch {}
    setReady(true)
  }, [userId, planChoice])

  React.useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(draftKey(userId), JSON.stringify({ step, data }))
    } catch {}
  }, [ready, userId, step, data])

  const set = <K extends keyof State>(key: K, value: State[K]) => setData((d) => ({ ...d, [key]: value }))
  const last = step === STEPS.length - 1
  const shown = STEPS.length - first

  function next() {
    if (last && data.name.trim().length < 2) {
      setNameError("Escribe el nombre de tu negocio (puedes cambiarlo después).")
      return
    }
    setNameError(null)
    if (last) void finish()
    else setStep((s) => s + 1)
  }

  async function finish() {
    setPending(true)
    // Si todo sale bien, la acción redirige (a los primeros pasos o al pago) y el borrador ya no hace falta.
    try {
      localStorage.removeItem(draftKey(userId))
    } catch {}
    const result = await completeOnboarding({ ...data, type: data.type || undefined }, planChoice)
    if (result && !result.ok) {
      setPending(false)
      toast.error(result.message)
      try {
        localStorage.setItem(draftKey(userId), JSON.stringify({ step, data }))
      } catch {}
    }
  }

  return (
    <div className="w-full max-w-xl space-y-6">
      {planChoice ? (
        <p className="text-sm text-muted-foreground">Un solo dato y vamos al pago.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paso {step + 1} de {shown}
          </p>
          <Progress value={((step + 1) / shown) * 100} className="h-1.5" aria-label={`Paso ${step + 1} de ${shown}`} />
        </div>
      )}

      <div key={step} className="animate-in space-y-6 rounded-2xl border bg-card p-5 shadow-sm duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none sm:p-8">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {step === 2 && planChoice ? `¡Hola, ${firstName}! ¿Cómo se llama tu negocio?` : STEPS[step].title}
          </h1>
          <p className="text-pretty text-muted-foreground">{step === 0 ? `Hola, ${firstName}. ${STEPS[0].description}` : STEPS[step].description}</p>
        </div>

        {step === 0 ? (
          <ol className="grid gap-2 text-sm sm:grid-cols-3">
            {["Tu rubro", "Los datos de tu negocio", "Tus primeros productos y una venta de ejemplo"].map((t, i) => (
              <li key={t} className="flex items-center gap-2.5 rounded-xl border bg-muted/40 px-3 py-2.5">
                <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de negocio">
              {RUBROS.map((r) => {
                const on = !otherOpen && data.type === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setOtherOpen(false)
                      set("type", r.value)
                    }}
                    className={cn(
                      "flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      on && "border-primary bg-accent ring-1 ring-primary",
                    )}
                  >
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", on ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                      <r.icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{r.label}</span>
                      <span className="block text-xs text-muted-foreground">{r.hint}</span>
                    </span>
                  </button>
                )
              })}
              <button
                type="button"
                role="radio"
                aria-checked={otherOpen}
                onClick={() => {
                  setOtherOpen(true)
                  if (RUBROS.some((r) => r.value === data.type)) set("type", "")
                }}
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:col-span-2",
                  otherOpen && "border-primary bg-accent ring-1 ring-primary",
                )}
              >
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", otherOpen ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                  <Plus className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">Otro negocio</span>
                  <span className="block text-xs text-muted-foreground">Elige entre más rubros, marca varios o escribe el tuyo</span>
                </span>
              </button>
            </div>
            {otherOpen ? <BusinessTypePicker value={data.type ?? ""} onChange={(v) => set("type", v)} /> : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <Field label="Nombre de tu negocio" htmlFor="name" error={nameError ?? undefined}>
              <Input
                id="name"
                autoFocus
                value={data.name}
                onChange={(e) => set("name", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), next())}
                placeholder="Ej: Almacén Don Pedro"
                className="h-11 text-base"
                maxLength={80}
              />
            </Field>
            {planChoice ? null : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="País">
                  <Select
                    value={data.country}
                    onValueChange={(v) => {
                      const c = COUNTRIES.find((x) => x.code === v)
                      setData((d) => ({ ...d, country: v, currency: c?.currency ?? d.currency }))
                    }}
                  >
                    <SelectTrigger className="h-11 w-full" aria-label="País">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Moneda">
                  <Select value={data.currency} onValueChange={(v) => set("currency", v)}>
                    <SelectTrigger className="h-11 w-full" aria-label="Moneda">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_CODES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code} · {CURRENCIES[code].name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
          </div>
        ) : null}

        {/* En el celular los botones van uno bajo otro (el principal arriba y a todo el ancho): lado a lado no caben. */}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          {step > first ? (
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setStep((s) => s - 1)} disabled={pending}>
              <ArrowLeft />
              Atrás
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {step === 1 ? (
              <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setStep(2)} disabled={pending}>
                Omitir
              </Button>
            ) : null}
            <Button size="lg" className="h-11 w-full px-5 sm:w-auto" onClick={next} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {step === 0 ? "Configurar mi negocio" : last ? (planChoice ? "Continuar al pago" : "Crear mi negocio") : "Continuar"}
              {!pending ? <ArrowRight /> : null}
            </Button>
          </div>
        </div>
      </div>
      {step > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          {planChoice ? "El rubro, el país y lo demás los completas después en Configuración." : "Todo esto se puede cambiar después en Configuración."}
        </p>
      ) : null}
    </div>
  )
}
