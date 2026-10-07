"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { BUSINESS_TYPES } from "@/lib/constants"
import { cn } from "@/lib/utils"

/** Varios rubros se guardan juntos en un solo texto: "Almacén o minimarket · Botillería". */
export const BUSINESS_TYPE_SEPARATOR = " · "
const OTHER = "Otro"
const KNOWN = BUSINESS_TYPES.filter((t) => t !== OTHER)

function parse(value: string) {
  const parts = value
    .split(BUSINESS_TYPE_SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean)
  const known = parts.filter((p) => KNOWN.includes(p))
  const custom = parts.filter((p) => !KNOWN.includes(p) && p !== OTHER).join(", ")
  return { known, other: custom.length > 0 || parts.includes(OTHER), custom }
}

/**
 * Rubro del negocio: se pueden marcar varios. Con "Otro" aparece un recuadro para escribirlo.
 * Entrega un solo texto con los rubros separados por " · ".
 */
export function BusinessTypePicker({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [state, setState] = React.useState(() => parse(value))
  // El recuadro toma el foco solo cuando la persona marca "Otro", no al abrir la página.
  const [focusOther, setFocusOther] = React.useState(false)

  function emit(next: typeof state) {
    setState(next)
    const custom = next.custom.replaceAll(BUSINESS_TYPE_SEPARATOR.trim(), " ").trim()
    onChange([...KNOWN.filter((t) => next.known.includes(t)), ...(next.other && custom ? [custom] : [])].join(BUSINESS_TYPE_SEPARATOR))
  }

  const chip = (label: string, on: boolean, toggle: () => void) => (
    <button
      key={label}
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/50 disabled:opacity-50",
        on && "border-primary bg-accent text-accent-foreground ring-1 ring-primary",
      )}
    >
      {on ? <Check className="size-3.5" /> : null}
      {label}
    </button>
  )

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Rubros del negocio">
        {KNOWN.map((t) =>
          chip(t, state.known.includes(t), () =>
            emit({ ...state, known: state.known.includes(t) ? state.known.filter((x) => x !== t) : [...state.known, t] }),
          ),
        )}
        {chip(OTHER, state.other, () => {
          setFocusOther(!state.other)
          emit({ ...state, other: !state.other })
        })}
      </div>
      {state.other ? (
        <Input
          autoFocus={focusOther}
          value={state.custom}
          onChange={(e) => emit({ ...state, custom: e.target.value })}
          placeholder="Escribe tu rubro. Ej: Botillería, panadería, librería…"
          maxLength={80}
          disabled={disabled}
          className="h-10"
          aria-label="Otro rubro"
        />
      ) : null}
      <p className="text-xs text-muted-foreground">Puedes elegir más de uno.</p>
    </div>
  )
}
