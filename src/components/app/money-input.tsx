"use client"

import * as React from "react"
import { currencySymbol, formatMoneyInput, getCurrency, parseMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"

type MoneyInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "size"> & {
  value: number
  onValueChange: (minor: number) => void
  currency?: string
  size?: "default" | "lg"
}

/** Input de dinero: la persona escribe 25000 y ve "25.000". Entrega el valor en unidades mínimas. */
export function MoneyInput({
  value,
  onValueChange,
  currency = "CLP",
  size = "default",
  className,
  ...props
}: MoneyInputProps) {
  const decimals = getCurrency(currency).decimals
  const [text, setText] = React.useState(value ? formatMoneyInput(value, currency) : "")

  // Sincroniza cuando el valor cambia desde afuera (por ejemplo al limpiar el formulario).
  const lastEmitted = React.useRef(value)
  React.useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      setText(value ? formatMoneyInput(value, currency) : "")
    }
  }, [value, currency])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const allowed = decimals > 0 ? raw.replace(/[^\d,]/g, "") : raw.replace(/\D/g, "")
    const minor = parseMoney(allowed, currency)
    lastEmitted.current = minor
    onValueChange(minor)
    if (decimals > 0 && allowed.includes(",")) {
      const [whole, frac] = allowed.split(",")
      const wholeFormatted = whole ? formatMoneyInput(Number(whole) * 10 ** decimals, currency) : "0"
      setText(`${wholeFormatted},${frac.slice(0, decimals)}`)
    } else {
      setText(allowed ? formatMoneyInput(minor, currency) : "")
    }
  }

  return (
    <div className={cn("relative", className)}>
      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground",
          size === "lg" ? "text-2xl" : "text-sm",
        )}
      >
        {currencySymbol(currency)}
      </span>
      <input
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        autoComplete="off"
        value={text}
        onChange={handleChange}
        placeholder="0"
        className={cn(
          "tabular w-full min-w-0 rounded-lg border border-input bg-transparent pr-3 shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
          size === "lg" ? "h-16 pl-10 text-3xl font-semibold" : "h-10 pl-7 text-base md:text-sm",
        )}
        {...props}
      />
    </div>
  )
}
