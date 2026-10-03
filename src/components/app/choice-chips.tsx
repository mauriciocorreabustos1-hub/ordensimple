"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

/** Opciones grandes y táctiles para preguntas simples. */
export function ChoiceChips<T extends string | boolean>({
  options,
  value,
  onChange,
  columns = 2,
  name,
}: {
  options: { value: T; label: string; description?: string }[]
  value: T | null | undefined
  onChange: (value: T) => void
  columns?: 1 | 2 | 3
  name: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn(
        "grid gap-2",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "grid-cols-2 sm:grid-cols-3",
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary/50",
              selected && "border-primary bg-accent ring-1 ring-primary",
            )}
          >
            <span>
              <span className="font-medium">{opt.label}</span>
              {opt.description ? <span className="block text-xs text-muted-foreground">{opt.description}</span> : null}
            </span>
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border",
                selected && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {selected ? <Check className="size-3" /> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
