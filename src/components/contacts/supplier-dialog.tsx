"use client"

import * as React from "react"
import { Loader2, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { saveSupplier } from "@/server/actions/contacts"

export type SupplierValues = {
  name: string
  phone: string
  email: string
  products: string
  deliveryCost: number
  notes: string
}
const EMPTY: SupplierValues = { name: "", phone: "", email: "", products: "", deliveryCost: 0, notes: "" }

export function SupplierDialog({ id, initial, currency }: { id?: string; initial?: SupplierValues; currency: string }) {
  const [open, setOpen] = React.useState(false)
  const [v, setV] = React.useState<SupplierValues>(initial ?? EMPTY)
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({})
  const [pending, startTransition] = React.useTransition()
  const set = <K extends keyof SupplierValues>(k: K, value: SupplierValues[K]) => setV((s) => ({ ...s, [k]: value }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (v.name.trim().length < 2) return setErrors({ name: "Escribe el nombre" })
    startTransition(async () => {
      const r = await saveSupplier(id ?? null, { ...v, deliveryCost: v.deliveryCost || undefined })
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
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Editar proveedor">
          <Pencil />
        </Button>
      ) : (
        <Button size="lg" className="h-10 px-4" onClick={() => setOpen(true)}>
          <Plus />
          Nuevo proveedor
        </Button>
      )}
      <AppModal open={open} onOpenChange={setOpen} title={id ? "Editar proveedor" : "Nuevo proveedor"}>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Nombre" htmlFor="s-name" error={errors.name}>
            <Input id="s-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} className="h-10" autoFocus placeholder="Ej: Distribuidora Central" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Teléfono" htmlFor="s-phone" optional error={errors.phone}>
              <Input id="s-phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} className="h-10" />
            </Field>
            <Field label="Correo" htmlFor="s-email" optional error={errors.email}>
              <Input id="s-email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} maxLength={120} className="h-10" />
            </Field>
          </div>
          <Field label="¿Qué te vende?" htmlFor="s-products" optional>
            <Input id="s-products" value={v.products} onChange={(e) => set("products", e.target.value)} maxLength={200} className="h-10" placeholder="Ej: bebidas, abarrotes" />
          </Field>
          <Field label="Costo de despacho" optional hint="Lo que te cobra por llevarte el pedido. Déjalo en 0 si es gratis.">
            <MoneyInput value={v.deliveryCost} onValueChange={(n) => set("deliveryCost", n)} currency={currency} aria-label="Costo de despacho" />
          </Field>
          <Field label="Notas" htmlFor="s-notes" optional>
            <Textarea id="s-notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} maxLength={300} rows={2} placeholder="Ej: pedido mínimo, días de reparto" />
          </Field>
          <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {id ? "Guardar cambios" : "Crear proveedor"}
          </Button>
        </form>
      </AppModal>
    </>
  )
}
