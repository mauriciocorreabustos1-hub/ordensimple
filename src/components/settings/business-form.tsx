"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field } from "@/components/app/field"
import { BUSINESS_TYPES, COUNTRIES } from "@/lib/constants"
import { CURRENCIES, CURRENCY_CODES } from "@/lib/currency"
import { updateBusiness } from "@/server/actions/settings"

export function BusinessForm({
  initial,
  currencyLocked,
  disabled,
}: {
  initial: { name: string; type: string; country: string; currency: string }
  currencyLocked: boolean
  disabled: boolean
}) {
  const [v, setV] = React.useState(initial)
  const [error, setError] = React.useState<string | undefined>()
  const [pending, startTransition] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (v.name.trim().length < 2) {
      setError("Escribe el nombre de tu negocio")
      return
    }
    setError(undefined)
    startTransition(async () => {
      const r = await updateBusiness(v)
      if (r.ok) toast.success(r.message ?? "Guardado")
      else toast.error(r.message)
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del negocio" htmlFor="b-name" error={error}>
          <Input id="b-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="h-10" maxLength={80} disabled={disabled} />
        </Field>
        <Field label="Tipo de negocio">
          <Select value={v.type || undefined} onValueChange={(type) => setV({ ...v, type })} disabled={disabled}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Elige uno" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="País">
          <Select value={v.country} onValueChange={(country) => setV({ ...v, country })} disabled={disabled}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Moneda"
          hint={currencyLocked ? "No se puede cambiar porque ya tienes datos registrados en esta moneda." : undefined}
        >
          <Select value={v.currency} onValueChange={(currency) => setV({ ...v, currency })} disabled={disabled || currencyLocked}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code} · {CURRENCIES[code].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {!disabled ? (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Guardar cambios
          </Button>
        </div>
      ) : null}
    </form>
  )
}
