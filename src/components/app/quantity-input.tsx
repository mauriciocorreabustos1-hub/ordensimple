"use client"

import * as React from "react"
import { allowsDecimals, parseQuantity, SALE_UNIT_INFO, saleUnitOf } from "@/lib/units"
import { cn } from "@/lib/utils"

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number
  unit: string | null | undefined
  onValueChange: (value: number) => void
  /** Si se acepta 0 (stock o conteo); si no, vacío o 0 entregan 0 igual y lo valida quien guarda. */
  className?: string
}

const show = (value: number, unit: string | null | undefined) =>
  value ? value.toLocaleString("es-CL", { maximumFractionDigits: SALE_UNIT_INFO[saleUnitOf(unit)].decimals, useGrouping: false }) : ""

/**
 * Cantidad según cómo se vende el producto: enteros por unidad; con coma decimal por kilo (hasta gramos) o por metro
 * (hasta centímetros), con la medida al lado ("kg" o "m").
 */
export function QuantityInput({ value, unit, onValueChange, className, ...props }: Props) {
  const u = saleUnitOf(unit)
  const [text, setText] = React.useState(() => show(value, u))
  const last = React.useRef(value)

  // Si el valor cambia desde afuera (otro producto, formulario limpio), se muestra el nuevo.
  React.useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setText(show(value, u))
    }
  }, [value, u])

  function change(raw: string) {
    const allowed = allowsDecimals(u) ? raw.replace(/[^\d,.]/g, "").replace(".", ",").replace(/,(?=.*,)/g, "") : raw.replace(/\D/g, "")
    setText(allowed)
    const parsed = allowed ? parseQuantity(allowed, u) : 0
    const next = parsed ?? 0
    last.current = next
    onValueChange(next)
  }

  const suffix = SALE_UNIT_INFO[u].short
  return (
    <div className={cn("relative", className)}>
      <input
        inputMode={allowsDecimals(u) ? "decimal" : "numeric"}
        autoComplete="off"
        value={text}
        onChange={(e) => change(e.target.value)}
        placeholder={allowsDecimals(u) ? SALE_UNIT_INFO[u].example : "0"}
        className={cn(
          "tabular h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
          suffix && "pr-9",
        )}
        {...props}
      />
      {suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span> : null}
    </div>
  )
}
