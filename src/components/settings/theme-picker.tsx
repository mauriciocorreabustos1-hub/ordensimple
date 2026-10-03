"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Automático", icon: Monitor },
]

export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  // El tema real solo se conoce en el navegador; evita marcar una opción incorrecta al hidratar.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  return (
    <div role="radiogroup" aria-label="Tema" className="grid max-w-md grid-cols-3 gap-2">
      {OPTIONS.map((o) => {
        const selected = mounted && theme === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(o.value)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border bg-card px-3 py-3 text-sm transition-colors hover:border-primary/50",
              selected && "border-primary bg-accent text-accent-foreground ring-1 ring-primary",
            )}
          >
            <o.icon className="size-4" />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
