"use client"

import * as React from "react"
import { cardFeeFor, cardFeeRate, formatRate, NO_CARD_FEES, type CardFees } from "@/lib/card-fees"
import { formatMoney } from "@/lib/currency"

const CardFeesContext = React.createContext<CardFees>(NO_CARD_FEES)

export function CardFeesProvider({ value, children }: { value: CardFees; children: React.ReactNode }) {
  return <CardFeesContext.Provider value={value}>{children}</CardFeesContext.Provider>
}

/** Al cobrar con débito o crédito: cuánto se queda la máquina y cuánto te llega. Solo si el negocio anotó su comisión. */
export function CardFeeNote({ total, method, currency }: { total: number; method: string; currency: string }) {
  const fees = React.useContext(CardFeesContext)
  const fee = cardFeeFor(total, method, fees)
  if (!fee) return null
  return (
    <p className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
      <span>
        La máquina cobra {formatRate(cardFeeRate(method, fees))}: <span className="tabular">−{formatMoney(fee, currency)}</span>
      </span>
      <span>
        Te llegan <span className="tabular font-semibold text-foreground">{formatMoney(total - fee, currency)}</span>
      </span>
    </p>
  )
}
