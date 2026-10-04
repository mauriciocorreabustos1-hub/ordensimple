"use client"

import * as React from "react"
import { Loader2, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { saveCustomer } from "@/server/actions/contacts"

type Values = { name: string; phone: string; email: string; notes: string }
const EMPTY: Values = { name: "", phone: "", email: "", notes: "" }

export function CustomerDialog({ id, initial }: { id?: string; initial?: Values }) {
  const [open, setOpen] = React.useState(false)
  const [v, setV] = React.useState<Values>(initial ?? EMPTY)
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({})
  const [pending, startTransition] = React.useTransition()
  const set = (k: keyof Values, value: string) => setV((s) => ({ ...s, [k]: value }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (v.name.trim().length < 2) return setErrors({ name: "Escribe el nombre" })
    startTransition(async () => {
      const r = await saveCustomer(id ?? null, v)
      if (!r.ok) {
        toast.error(r.message)
        if (r.fieldErrors) setErrors(Object.fromEntries(Object.entries(r.fieldErrors).map(([k, m]) => [k, m?.[0]])))
        return
      }
      toast.success(r.message ?? "Guardado")
      setOpen(false)
      setErrors({})
      if (!id) setV(EMPTY)
    })
  }

  return (
    <>
      {id ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil />
          Editar
        </Button>
      ) : (
        <Button size="lg" className="h-10 px-4" onClick={() => setOpen(true)}>
          <Plus />
          Nuevo cliente
        </Button>
      )}
      <AppModal open={open} onOpenChange={setOpen} title={id ? "Editar cliente" : "Nuevo cliente"}>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Nombre" htmlFor="c-name" error={errors.name}>
            <Input id="c-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} className="h-10" autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Teléfono" htmlFor="c-phone" optional error={errors.phone}>
              <Input id="c-phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} className="h-10" placeholder="+56 9 1234 5678" />
            </Field>
            <Field label="Correo" htmlFor="c-email" optional error={errors.email}>
              <Input id="c-email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} maxLength={120} className="h-10" />
            </Field>
          </div>
          <Field label="Notas" htmlFor="c-notes" optional>
            <Textarea id="c-notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} maxLength={300} rows={3} placeholder="Ej: prefiere pagar con transferencia" />
          </Field>
          <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {id ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </form>
      </AppModal>
    </>
  )
}
