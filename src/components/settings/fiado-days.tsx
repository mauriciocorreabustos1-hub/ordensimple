"use client"

import * as React from "react"
import { toast } from "sonner"
import { ChoiceChips } from "@/components/admin/choice-chips"
import { updatePreferences } from "@/server/actions/settings"

/** Plazo para pagar el fiado: pasado esto, el cliente aparece en "Por cobrar" y en el aviso por correo. */
export function FiadoDays({ value, disabled }: { value: number; disabled?: boolean }) {
  const [days, setDays] = React.useOptimistic(value)
  const [, startTransition] = React.useTransition()

  function change(next: number) {
    if (disabled || next === days) return
    startTransition(async () => {
      setDays(next)
      const r = await updatePreferences({ fiadoDays: next })
      if (r.ok) toast.success(`Plazo del fiado: ${next} días`)
      else toast.error(r.message)
    })
  }

  return (
    <div className="space-y-2 py-3">
      <p className="text-sm font-medium">¿En cuántos días te deben pagar el fiado?</p>
      <ChoiceChips options={[7, 15, 30, 60].map((d) => ({ value: d, label: `${d} días` }))} value={days} onChange={change} />
      <p className="text-xs text-muted-foreground">Pasado ese plazo, el cliente aparece en «Por cobrar» en Clientes.</p>
    </div>
  )
}
