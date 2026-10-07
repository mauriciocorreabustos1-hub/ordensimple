"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, Loader2, Rocket } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field } from "@/components/app/field"
import { ChoiceChips } from "@/components/app/choice-chips"
import { COUNTRIES, REVENUE_RANGES } from "@/lib/constants"
import { BusinessTypePicker } from "@/components/app/business-type-picker"
import { CURRENCIES, CURRENCY_CODES } from "@/lib/currency"
import type { OnboardingInput } from "@/lib/validations"
import { completeOnboarding } from "@/server/actions/onboarding"

const YES_NO = [
  { value: true, label: "Sí" },
  { value: false, label: "No" },
]

type State = Required<Pick<OnboardingInput, "name" | "country" | "currency">> & OnboardingInput

const STEPS = [
  { title: "Cuéntanos de tu negocio", description: "Empecemos por lo básico." },
  { title: "País y moneda", description: "Así mostramos los montos como estás acostumbrado." },
  { title: "Cómo trabajas", description: "Con esto adaptamos OrdenSimple a tu negocio." },
  { title: "Tamaño del negocio", description: "Nos ayuda a darte mejores consejos más adelante." },
]

export function OnboardingWizard({ firstName, planChoice }: { firstName: string; planChoice?: string }) {
  const [step, setStep] = React.useState(0)
  const [pending, setPending] = React.useState(false)
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<State>({ name: "", country: "CL", currency: "CLP" })

  const set = <K extends keyof State>(key: K, value: State[K]) => setData((d) => ({ ...d, [key]: value }))
  const last = step === STEPS.length - 1

  function next() {
    if (step === 0 && data.name.trim().length < 2) {
      setNameError("Escribe el nombre de tu negocio (puedes cambiarlo después).")
      return
    }
    setNameError(null)
    if (last) void finish()
    else setStep((s) => s + 1)
  }

  async function finish() {
    setPending(true)
    const result = await completeOnboarding(data, planChoice)
    // Si todo sale bien, la acción redirige al dashboard.
    if (result && !result.ok) {
      setPending(false)
      toast.error(result.message)
    }
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Paso {step + 1} de {STEPS.length}
        </p>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
      </div>

      <div className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {step === 0 ? `¡Hola, ${firstName}! ${STEPS[0].title}` : STEPS[step].title}
          </h1>
          <p className="text-sm text-muted-foreground">{STEPS[step].description}</p>
        </div>

        {step === 0 ? (
          <div className="space-y-5">
            <Field label="¿Cómo se llama tu negocio?" htmlFor="name" error={nameError ?? undefined}>
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
            <Field label="¿Qué tipo de negocio es?" optional>
              <BusinessTypePicker value={data.type ?? ""} onChange={(v) => set("type", v)} />
            </Field>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="País">
              <Select
                value={data.country}
                onValueChange={(v) => {
                  const c = COUNTRIES.find((x) => x.code === v)
                  setData((d) => ({ ...d, country: v, currency: c?.currency ?? d.currency }))
                }}
              >
                <SelectTrigger className="h-11 w-full">
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
                <SelectTrigger className="h-11 w-full">
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
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <Field label="¿Vendes productos?">
              <ChoiceChips name="Productos" options={YES_NO} value={data.hasProducts} onChange={(v) => set("hasProducts", v)} />
            </Field>
            <Field label="¿Tienes trabajadores?">
              <ChoiceChips name="Trabajadores" options={YES_NO} value={data.hasEmployees} onChange={(v) => set("hasEmployees", v)} />
            </Field>
            <Field label="¿Llevas control de stock o inventario?">
              <ChoiceChips
                name="Inventario"
                options={YES_NO}
                value={data.managesInventory}
                onChange={(v) => set("managesInventory", v)}
              />
            </Field>
          </div>
        ) : null}

        {step === 3 ? (
          <Field label="¿Cuánto vendes al mes, más o menos?" optional>
            <ChoiceChips
              name="Facturación mensual"
              columns={1}
              options={REVENUE_RANGES.map((r) => ({ value: r, label: r }))}
              value={data.monthlyRevenueRange}
              onChange={(v) => set("monthlyRevenueRange", v)}
            />
          </Field>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-2">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={pending}>
              <ArrowLeft />
              Atrás
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {step > 0 && !last ? (
              <Button variant="ghost" onClick={() => setStep((s) => s + 1)} disabled={pending}>
                Omitir
              </Button>
            ) : null}
            <Button size="lg" className="h-11 px-5" onClick={next} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : last ? <Rocket /> : null}
              {last ? "Empezar a usar OrdenSimple" : "Continuar"}
              {!last && !pending ? <ArrowRight /> : null}
            </Button>
          </div>
        </div>
      </div>
      {step > 0 ? (
        <p className="text-center text-xs text-muted-foreground">Todo esto se puede cambiar después en Configuración.</p>
      ) : null}
    </div>
  )
}
