"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { createBranch } from "@/server/actions/branches"
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
