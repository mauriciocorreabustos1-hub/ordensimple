"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { createBranch, deleteBranch } from "@/server/actions/branches"
import { switchBusiness } from "@/server/actions/team"

/** Botón "Agregar sucursal" con su formulario. */
export function AddBranchButton({ disabledReason }: { disabledReason: string | null }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [error, setError] = React.useState<string | undefined>()
  const [pending, startTransition] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await createBranch({ name })
      if (!r.ok) return setError(r.fieldErrors?.name?.[0] ?? r.message)
      toast.success(r.message ?? "Sucursal creada")
      setOpen(false)
      router.push("/dashboard")
      router.refresh()
    })
  }

  return (
    <>
      <Button
        size="lg"
        className="h-10"
        onClick={() => {
          if (disabledReason) return void toast.info(disabledReason)
          setName("")
          setError(undefined)
          setOpen(true)
        }}
      >
        <Plus />
        Agregar sucursal
      </Button>
      <AppModal
        open={open}
        onOpenChange={setOpen}
        title="Nueva sucursal"
        description="Tendrá sus propias ventas, gastos, productos y caja. Usa el mismo país, moneda y rubro de tu negocio actual."
      >
        <form onSubmit={submit} className="grid gap-5">
          <Field label="Nombre de la sucursal" htmlFor="branch-name" error={error} hint="Ej.: Almacén Don Pedro · Sucursal Centro">
            <Input
              id="branch-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(undefined)
              }}
              maxLength={80}
              className="h-10"
              autoFocus
            />
          </Field>
          <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />}
            Crear sucursal
          </Button>
        </form>
      </AppModal>
    </>
  )
}

/** Botón para cambiarse a otra sucursal. */
export function EnterBranchButton({ businessId }: { businessId: string }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await switchBusiness(businessId)
          if (!r.ok) return void toast.error(r.message)
          toast.success(r.message ?? "Listo")
          router.push("/dashboard")
          router.refresh()
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : null}
      Entrar
      <ArrowRight />
    </Button>
  )
}

/** Eliminar una sucursal: se confirma escribiendo su nombre. */
export function DeleteBranchButton({ businessId, name }: { businessId: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [confirm, setConfirm] = React.useState("")
  const [pending, startTransition] = React.useTransition()
  const matches = confirm.trim().toLowerCase() === name.trim().toLowerCase()

  return (
    <>
      <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setOpen(true)}>
        <Trash2 />
        Eliminar
      </Button>
      <AppModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) setConfirm("")
        }}
        title={`Eliminar ${name}`}
        description="Se borran para siempre sus ventas, gastos, productos, clientes, fiado y cierres de caja. Tus otras sucursales no se tocan. Esto no se puede deshacer."
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            startTransition(async () => {
              const r = await deleteBranch({ businessId, confirmName: confirm })
              if (!r.ok) return void toast.error(r.message)
              toast.success(r.message ?? "Sucursal eliminada")
              setOpen(false)
              router.refresh()
            })
          }}
        >
          <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            ¿Quieres guardar sus datos? Antes descárgalos en Configuración, sección Tu cuenta, opción Descargar mis datos (estando en esta sucursal).
          </p>
          <Field label={`Para confirmar, escribe: ${name}`} htmlFor="del-branch">
            <Input id="del-branch" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-10" autoComplete="off" />
          </Field>
          <Button type="submit" variant="destructive" size="lg" className="h-11" disabled={!matches || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Eliminar sucursal para siempre
          </Button>
        </form>
      </AppModal>
    </>
  )
}
