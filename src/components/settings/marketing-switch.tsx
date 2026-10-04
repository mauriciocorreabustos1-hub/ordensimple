"use client"

import * as React from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { updateMarketingOptIn } from "@/server/actions/settings"

export function MarketingSwitch({ checked }: { checked: boolean }) {
  const [optimistic, setOptimistic] = React.useOptimistic(checked)
  const [, startTransition] = React.useTransition()
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <label htmlFor="pref-marketing" className="space-y-0.5">
        <span className="block text-sm font-medium">Novedades y ofertas de OrdenSimple</span>
        <span className="block text-xs text-muted-foreground">Consejos, funciones nuevas y descuentos. Es personal: solo afecta tu correo.</span>
      </label>
      <Switch
        id="pref-marketing"
        checked={optimistic}
        onCheckedChange={(value) =>
          startTransition(async () => {
            setOptimistic(value)
            const r = await updateMarketingOptIn(value)
            if (r.ok) toast.success(r.message ?? "Guardado")
            else toast.error(r.message)
          })
        }
      />
    </div>
  )
}
