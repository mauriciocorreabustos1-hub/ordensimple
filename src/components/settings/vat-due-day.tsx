"use client"

import * as React from "react"
import { toast } from "sonner"
import { ChoiceChips } from "@/components/admin/choice-chips"
import { updatePreferences } from "@/server/actions/settings"

/** Día del mes siguiente en que vence el pago del IVA. */
export function VatDueDay({ value, chile, disabled }: { value: number; chile: boolean; disabled?: boolean }) {
  const [day, setDay] = React.useOptimistic(value)
  const [, startTransition] = React.useTransition()

  function change(next: number) {
    if (disabled || next === day) return
    startTransition(async () => {
      setDay(next)
      const r = await updatePreferences({ vatDueDay: next })
      if (r.ok) toast.success("Fecha de pago guardada")
      else toast.error(r.message)
    })
  }

  const options = chile
    ? [
        { value: 20, label: "Día 20" },
        { value: 12, label: "Día 12" },
      ]
    : [10, 12, 15, 18, 20, 25].map((d) => ({ value: d, label: `Día ${d}` }))

  return (
    <div className="space-y-2 py-3">
      <p className="text-sm font-medium">¿Hasta qué día del mes siguiente pagas el IVA?</p>
      <ChoiceChips options={options} value={day} onChange={change} />
      <p className="text-xs text-muted-foreground">
        {chile
          ? "En el Formulario 29: hasta el día 20 si emites boletas o facturas electrónicas y declaras por internet (lo más común); si no, hasta el día 12. Si tienes contador, pregúntale."
          : "Elige el día en que vence el pago del impuesto en tu país."}
      </p>
    </div>
  )
}
