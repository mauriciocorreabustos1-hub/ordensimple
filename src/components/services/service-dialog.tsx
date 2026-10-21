"use client"

import * as React from "react"
import { Loader2, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { durationLabel } from "@/lib/agenda"
import { cn } from "@/lib/utils"
import { createProduct, updateProduct } from "@/server/actions/products"

export type ServiceValues = { name: string; price: number; cost: number; durationMin: number; active: boolean }
const EMPTY: ServiceValues = { name: "", price: 0, cost: 0, durationMin: 30, active: true }
const DURATIONS = [15, 30, 45, 60, 90, 120]

/** Crear o editar un servicio: nombre, precio, cuánto dura y (opcional) lo que te cuestan los materiales. */
export function ServiceDialog({ serviceId, initial, currency }: { serviceId?: string; initial?: ServiceValues; currency: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      {serviceId ? (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Editar servicio">
          <Pencil />
        </Button>
      ) : (
        <Button size="lg" className="h-10 px-4" onClick={() => setOpen(true)}>
          <Plus />
          Nuevo servicio
        </Button>
      )}
      <AppModal open={open} onOpenChange={setOpen} title={serviceId ? "Editar servicio" : "Nuevo servicio"}>
        {open ? <ServiceForm serviceId={serviceId} initial={initial ?? EMPTY} currency={currency} onDone={() => setOpen(false)} /> : null}
      </AppModal>
    </>
  )
}

function ServiceForm({ serviceId, initial, currency, onDone }: { serviceId?: string; initial: ServiceValues; currency: string; onDone: () => void }) {
  const [v, setV] = React.useState(initial)
  const [pending, startTransition] = React.useTransition()
  const set = <K extends keyof ServiceValues>(k: K, value: ServiceValues[K]) => setV((s) => ({ ...s, [k]: value }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (v.name.trim().length < 2) return void toast.error("Escribe el nombre del servicio")
    if (v.price <= 0) return void toast.error("Ponle precio al servicio")
    if (v.durationMin < 5) return void toast.error("¿Cuánto dura? Mínimo 5 minutos")
    startTransition(async () => {
      const input = {
        name: v.name,
        price: v.price,
        cost: v.cost,
        durationMin: v.durationMin,
        active: v.active,
        isService: true,
        trackStock: false,
        stock: 0,
        minStock: 0,
        codes: [],
      }
      const r = serviceId ? await updateProduct(serviceId, input) : await createProduct(input)
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message ?? "Guardado")
      onDone()
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label="Nombre del servicio" htmlFor="s-name">
        <Input id="s-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej.: Corte de pelo, Consulta, Clase de yoga" maxLength={100} className="h-10" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Precio" htmlFor="s-price">
          <MoneyInput id="s-price" value={v.price} onValueChange={(n) => set("price", n)} currency={currency} />
        </Field>
        <Field label="Lo que te cuesta" htmlFor="s-cost" optional hint="Materiales o insumos (tinte, guantes…). Para saber cuánto te queda.">
          <MoneyInput id="s-cost" value={v.cost} onValueChange={(n) => set("cost", n)} currency={currency} />
        </Field>
      </div>
      <Field label="¿Cuánto dura?" htmlFor="s-duration" hint="Con esto la Agenda reserva el tiempo justo y tus clientes ven las horas libres.">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="s-duration"
            inputMode="numeric"
            value={v.durationMin || ""}
            onChange={(e) => set("durationMin", Math.min(720, Number(e.target.value.replace(/\D/g, "")) || 0))}
            className="tabular h-10 w-20"
          />
          <span className="text-sm text-muted-foreground">min</span>
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set("durationMin", m)}
              aria-pressed={v.durationMin === m}
              className={cn("rounded-full border px-2.5 py-1 text-xs", v.durationMin === m ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
            >
              {durationLabel(m)}
            </button>
          ))}
        </div>
      </Field>
      <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
        <div>
          <p className="text-sm font-medium">Servicio activo</p>
          <p className="text-xs text-muted-foreground">Los inactivos no aparecen al agendar, cobrar ni en tu página de reservas.</p>
        </div>
        <Switch checked={v.active} onCheckedChange={(c) => set("active", c)} aria-label="Servicio activo" />
      </div>
      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {serviceId ? "Guardar cambios" : "Crear servicio"}
      </Button>
    </form>
  )
}
