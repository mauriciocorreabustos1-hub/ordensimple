"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addDays, startOfMonth, toDateKey } from "@/lib/dates"
import { cn } from "@/lib/utils"

/** Filtro de fechas con atajos. Guarda el rango en la URL (?desde=&hasta=). */
export function DateRangeFilter({ desde, hasta, timezone }: { desde: string; hasta: string; timezone: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = React.useTransition()

  const now = new Date()
  const today = toDateKey(now, timezone)
  const presets = [
    { label: "Hoy", desde: today, hasta: today },
    { label: "7 días", desde: toDateKey(addDays(now, -6, timezone), timezone), hasta: today },
    { label: "Este mes", desde: toDateKey(startOfMonth(now, timezone), timezone), hasta: today },
    {
      label: "Mes pasado",
      desde: toDateKey(startOfMonth(now, timezone, -1), timezone),
      hasta: toDateKey(addDays(startOfMonth(now, timezone), -1, timezone), timezone),
    },
  ]

  function go(d: string, h: string) {
    if (!d || !h) return
    startTransition(() => router.replace(`${pathname}?desde=${d}&hasta=${h}`, { scroll: false }))
  }

  return (
    <div className={cn("flex flex-col gap-2 md:flex-row md:items-center md:justify-between", pending && "opacity-70")}>
      <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0">
        {presets.map((p) => {
          const active = p.desde === desde && p.hasta === hasta
          return (
            <Button
              key={p.label}
              size="sm"
              variant={active ? "default" : "outline"}
              className="h-8 shrink-0 rounded-full px-3"
              onClick={() => go(p.desde, p.hasta)}
            >
              {p.label}
            </Button>
          )
        })}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Input
          type="date"
          aria-label="Desde"
          value={desde}
          max={hasta}
          onChange={(e) => go(e.target.value, hasta)}
          className="h-8 w-full md:w-40"
        />
        <span className="text-muted-foreground">a</span>
        <Input
          type="date"
          aria-label="Hasta"
          value={hasta}
          min={desde}
          onChange={(e) => go(desde, e.target.value)}
          className="h-8 w-full md:w-40"
        />
      </div>
    </div>
  )
}
