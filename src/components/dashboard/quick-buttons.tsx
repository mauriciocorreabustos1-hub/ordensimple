"use client"

import { Receipt, ShoppingBag } from "lucide-react"
import { QuickActionButton } from "@/components/app/quick-actions"

export function QuickButtons({ onDark }: { /** Dentro del panel verde del Inicio. */ onDark?: boolean }) {
  if (onDark) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <QuickActionButton
          action="sale"
          className="flex h-14 items-center justify-center gap-2.5 rounded-xl bg-deep-foreground px-4 text-base font-semibold text-deep transition hover:bg-deep-foreground/90 active:scale-[0.98]"
        >
          <ShoppingBag className="size-5" />
          <span className="text-left leading-tight">Registrar venta</span>
        </QuickActionButton>
        <QuickActionButton
          action="expense"
          className="flex h-14 items-center justify-center gap-2.5 rounded-xl border border-deep-foreground/40 px-4 text-base font-semibold text-deep-foreground transition hover:bg-deep-foreground/10 active:scale-[0.98]"
        >
          <Receipt className="size-5" />
          <span className="text-left leading-tight">Registrar gasto</span>
        </QuickActionButton>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <QuickActionButton
        action="sale"
        className="flex h-20 items-center justify-center gap-3 rounded-2xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98] md:h-16"
      >
        <ShoppingBag className="size-6 md:size-5" />
        <span className="text-left leading-tight">Registrar venta</span>
      </QuickActionButton>
      <QuickActionButton
        action="expense"
        className="flex h-20 items-center justify-center gap-3 rounded-2xl border-2 bg-card px-4 text-base font-semibold shadow-xs transition hover:bg-muted active:scale-[0.98] md:h-16"
      >
        <Receipt className="size-6 text-chart-2 md:size-5" />
        <span className="text-left leading-tight">Registrar gasto</span>
      </QuickActionButton>
    </div>
  )
}
