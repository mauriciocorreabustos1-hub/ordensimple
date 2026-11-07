"use client"

import * as React from "react"
import { MoneyInput } from "@/components/app/money-input"
import { formatMoney, getCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"

// Billetes y monedas habituales (en unidades enteras de la moneda), para sugerir con cuánto suele pagar el cliente.
const DENOMINATIONS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]

/** Montos con los que probablemente paguen: el total redondeado hacia arriba a un billete acorde, los 3 más cercanos. */
function suggestions(total: number, decimals: number) {
  const unit = 10 ** decimals
  const options = new Set<number>()
  for (const d of DENOMINATIONS) {
    const step = d * unit
    // Billetes acordes al total: para $3.450 se sugiere $3.500 o $5.000, no $3.460.
    if (step * 10 < total) continue
    const rounded = Math.ceil(total / step) * step
    if (rounded > total) options.add(rounded)
  }
  return [...options].sort((a, b) => a - b).slice(0, 3)
}

/**
 * Pago en efectivo: con cuánto pagó el cliente y cuánto vuelto hay que darle. Solo ayuda a cobrar; no se guarda en la venta.
 * Para empezar de cero en la siguiente venta, el padre le cambia la `key`.
 */
export function CashChange({ total, currency, className }: { total: number; currency: string; className?: string }) {
  const [received, setReceived] = React.useState(0)
  const decimals = getCurrency(currency).decimals
  const quick = React.useMemo(() => suggestions(total, decimals), [total, decimals])
  if (total <= 0) return null

  const change = received - total
  const money = (v: number) => formatMoney(v, currency)

  return (
    <div className={cn("grid gap-3 rounded-xl border border-dashed bg-card p-3", className)}>
      <div className="grid gap-1.5">
        <label htmlFor="cash-received" className="text-sm font-medium">
          ¿Con cuánto te pagó?
        </label>
        <MoneyInput id="cash-received" value={received} onValueChange={setReceived} currency={currency} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Montos rápidos">
          <QuickAmount active={received === total} onClick={() => setReceived(total)}>
            Justo
          </QuickAmount>
          {quick.map((v) => (
            <QuickAmount key={v} active={received === v} onClick={() => setReceived(v)}>
              {money(v)}
            </QuickAmount>
          ))}
        </div>
      </div>
      {received > 0 ? (
        <div
          aria-live="polite"
          className={cn(
            "flex items-baseline justify-between gap-3 rounded-lg px-3 py-2",
            change >= 0 ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-destructive/10 text-destructive",
          )}
        >
          <span className="text-sm font-medium">{change > 0 ? "Vuelto" : change === 0 ? "Pago exacto" : "Faltan"}</span>
          <span className="tabular text-2xl font-semibold">{change === 0 ? "Sin vuelto" : money(Math.abs(change))}</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Opcional: escribe lo que te entregó y te calculamos el vuelto.</p>
      )}
    </div>
  )
}

function QuickAmount({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "tabular rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}
