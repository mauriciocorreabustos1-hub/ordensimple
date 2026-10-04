"use client"

import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

/** Porcentaje con barra deslizante y campo numérico. */
export function PercentInput({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  label,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  label: string
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[Math.min(max, Math.max(min, value))]}
        onValueChange={([n]) => onChange(n)}
        aria-label={label}
        className="flex-1 cursor-pointer py-2 [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-primary [&_[data-slot=slider-thumb]]:shadow-sm [&_[data-slot=slider-track]]:h-2"
      />
      <div className="relative w-20">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value.replace(",", ".").replace(/[^\d.-]/g, ""))
            if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
          }}
          className="tabular h-10 w-full rounded-lg border border-input bg-transparent pr-7 pl-3 text-right text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          aria-label={`${label} (número)`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
      </div>
    </div>
  )
}
