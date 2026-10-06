"use client"

import * as React from "react"
import { toast } from "sonner"
import { ChoiceChips } from "@/components/admin/choice-chips"
import { PPM_OPTIONS } from "@/lib/vat"
import { updatePreferences } from "@/server/actions/settings"

/** Tasa del PPM (pago provisional mensual) que se paga junto con el IVA en el F29. */
export function PpmRate({ value, disabled }: { value: number; disabled?: boolean }) {
  const [rate, setRate] = React.useOptimistic(value)
  const [, startTransition] = React.useTransition()

  function change(next: number) {
    if (disabled || next === rate) return
    startTransition(async () => {
      setRate(next)
      const r = await updatePreferences({ ppmRate: next })
      if (r.ok) toast.success("Tasa de PPM guardada")
      else toast.error(r.message)
    })
  }

  const known = PPM_OPTIONS.some((o) => o.value === rate)
  const options = [
    ...PPM_OPTIONS.map((o) => ({ value: o.value as number, label: o.hint ? `${o.label} · ${o.hint}` : o.label })),
    ...(known ? [] : [{ value: rate, label: `${(rate * 100).toLocaleString("es-CL", { maximumFractionDigits: 3 })}%` }]),
  ]

  return (
    <div className="space-y-2 py-3">
      <p className="text-sm font-medium">PPM (pago provisional mensual)</p>
      <ChoiceChips options={options} value={rate} onChange={change} />
      <p className="text-xs text-muted-foreground">
        Se paga en el mismo F29, sobre tus ventas sin IVA. La mayoría de las pymes está en el régimen Pro Pyme General:
        0,125% en 2025, 2026 y 2027 (si vendiste menos de 50.000 UF el año pasado). Tu tasa exacta aparece en tu F29 anterior
        o te la dice tu contador.
      </p>
    </div>
  )
}
