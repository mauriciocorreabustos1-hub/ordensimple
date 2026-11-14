"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/currency"
import { MAX_CARD_FEE } from "@/lib/card-fees"
import { updatePreferences } from "@/server/actions/settings"

const show = (n: number) => (n ? n.toLocaleString("es-CL", { maximumFractionDigits: 2, useGrouping: false }) : "")

/** "1,79" o "1.79" como número; vacío es 0. Null si no es un porcentaje. */
function parseRate(text: string) {
  const clean = text.trim().replace("%", "").replace(",", ".")
  if (!clean) return 0
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  const n = Number(clean)
  return n <= MAX_CARD_FEE ? n : null
}

/** Comisión de la máquina de tarjetas (POS) por débito y por crédito. */
export function CardFeesSettings({ debit, credit, currency, disabled }: { debit: number; credit: number; currency: string; disabled?: boolean }) {
  const [d, setD] = React.useState(show(debit))
  const [c, setC] = React.useState(show(credit))
  const [pending, startTransition] = React.useTransition()
  const pd = parseRate(d)
  const pc = parseRate(c)
  const changed = pd !== debit || pc !== credit

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (pd === null || pc === null) return toast.error(`Escribe un porcentaje entre 0 y ${MAX_CARD_FEE}, con hasta 2 decimales.`)
    startTransition(async () => {
      const r = await updatePreferences({ cardFeeDebit: pd, cardFeeCredit: pc })
      if (r.ok) toast.success(pd || pc ? "Comisión de la máquina guardada" : "Sin comisión de máquina")
      else toast.error(r.message)
    })
  }

  // Ejemplo con una venta de $10.000, para que se entienda qué se resta.
  const sample = 10_000
  const example = pc ? `Con crédito, de una venta de ${formatMoney(sample, currency)} te llegan ${formatMoney(sample - Math.round((sample * pc) / 100), currency)}.` : null

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["fee-debit", "Débito", d, setD, pd],
            ["fee-credit", "Crédito", c, setC, pc],
          ] as const
        ).map(([id, label, value, set, parsed]) => (
          <div key={id} className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="relative">
              <Input
                id={id}
                inputMode="decimal"
                value={value}
                onChange={(e) => set(e.target.value.replace(/[^\d,.]/g, ""))}
                placeholder="0"
                className="tabular h-10 pr-8"
                disabled={disabled}
                aria-invalid={parsed === null}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-pretty text-muted-foreground">
        Escribe el porcentaje con IVA incluido: si te cobran 2,95% + IVA, escribe 3,51. Lo encuentras en tu contrato o en el detalle de
        abonos de tu proveedor. Si no usas máquina, déjalo vacío. {example}
      </p>
      <Button type="submit" disabled={disabled || pending || !changed}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Guardar comisión
      </Button>
    </form>
  )
}
