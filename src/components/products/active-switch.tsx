"use client"

import * as React from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { toggleProductActive } from "@/server/actions/products"

export function ActiveSwitch({ id, active, disabled }: { id: string; active: boolean; disabled?: boolean }) {
  const [optimistic, setOptimistic] = React.useOptimistic(active)
  const [, startTransition] = React.useTransition()

  return (
    <Switch
      checked={optimistic}
      disabled={disabled}
      aria-label={optimistic ? "Desactivar producto" : "Activar producto"}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          setOptimistic(checked)
          const result = await toggleProductActive(id, checked)
          if (!result.ok) toast.error(result.message)
        })
      }
    />
  )
}
