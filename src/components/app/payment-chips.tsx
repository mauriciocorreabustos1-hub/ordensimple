"use client"

import { Banknote, CreditCard, Landmark, MoreHorizontal, NotebookPen, Wallet } from "lucide-react"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { PAYMENT_METHODS } from "@/lib/constants"
import { cn } from "@/lib/utils"

const ICONS: Record<PaymentMethod, typeof Banknote> = {
  CASH: Banknote,
  DEBIT: Wallet,
  CREDIT: CreditCard,
  TRANSFER: Landmark,
  OTHER: MoreHorizontal,
  FIADO: NotebookPen,
}

export function PaymentChips({
  value,
  onChange,
  allowFiado = true,
}: {
  value: PaymentMethod
  onChange: (value: PaymentMethod) => void
  /** Los abonos de fiado no pueden pagarse "fiado". */
  allowFiado?: boolean
}) {
  const methods = allowFiado ? PAYMENT_METHODS : PAYMENT_METHODS.filter((m) => m.value !== "FIADO")
  return (
    <div role="radiogroup" aria-label="Método de pago" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {methods.map((m) => {
        const Icon = ICONS[m.value]
        const selected = value === m.value
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(m.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border bg-card px-2 py-2.5 text-xs font-medium transition-colors hover:border-primary/50",
              selected && "border-primary bg-accent text-accent-foreground ring-1 ring-primary",
            )}
          >
            <Icon className="size-4" />
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
