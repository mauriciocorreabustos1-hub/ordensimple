"use client"

import { cn } from "@/lib/utils"

/** Botones de opción simples (uno seleccionado a la vez). */
export function ChoiceChips<T extends string | number | null>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 rounded-lg border px-3 text-sm font-medium transition-colors",
            o.value === value ? "border-primary bg-primary/10 text-primary" : "bg-background hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
