"use client"

import * as React from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import type { PreferencesInput } from "@/lib/validations"
import { updatePreferences } from "@/server/actions/settings"

export function PreferenceSwitch({
  name,
  label,
  description,
  checked,
  disabled,
}: {
  name: keyof PreferencesInput
  label: string
  description: string
  checked: boolean
  disabled?: boolean
}) {
  const [optimistic, setOptimistic] = React.useOptimistic(checked)
  const [, startTransition] = React.useTransition()
  const id = `pref-${name}`

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <label htmlFor={id} className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </label>
      <Switch
        id={id}
        checked={optimistic}
        disabled={disabled}
        onCheckedChange={(value) =>
          startTransition(async () => {
            setOptimistic(value)
            const r = await updatePreferences({ [name]: value })
            if (r.ok) toast.success(r.message ?? "Guardado")
            else toast.error(r.message)
          })
        }
      />
    </div>
  )
}
