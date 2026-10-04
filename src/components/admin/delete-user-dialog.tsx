"use client"

import * as React from "react"
import { Loader2, Trash2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { deleteUserAccount } from "@/server/actions/admin"

export type OwnedBusiness = { name: string; sales: number; others: number }

/** Eliminar una cuenta desde /admin. Pide escribir el correo para confirmar. */
export function DeleteUserDialog({
  userId,
  name,
  email,
  ownedBusinesses,
}: {
  userId: string
  name: string
  email: string
  ownedBusinesses: OwnedBusiness[]
}) {
  const [open, setOpen] = React.useState(false)
  const [confirm, setConfirm] = React.useState("")
  const [pending, startTransition] = React.useTransition()
  const matches = confirm.trim().toLowerCase() === email.toLowerCase()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!matches) return
    startTransition(async () => {
      const r = await deleteUserAccount({ userId, confirmEmail: confirm })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message ?? "Cuenta eliminada")
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        className="text-destructive"
        aria-label={`Eliminar la cuenta de ${name}`}
        title="Eliminar cuenta"
        onClick={() => {
          setConfirm("")
          setOpen(true)
        }}
      >
        <Trash2 />
      </Button>
      <AppModal open={open} onOpenChange={setOpen} title={`Eliminar la cuenta de ${name}`} description={email}>
        <form onSubmit={submit} className="grid gap-5">
          <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" />
              Esto no se puede deshacer.
            </p>
            <p>Se borrará la cuenta y no podrá volver a entrar con ella.</p>
            {ownedBusinesses.length ? (
              <>
                <p>También se borrarán sus negocios, con todas sus ventas, gastos, productos y clientes:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {ownedBusinesses.map((b) => (
                    <li key={b.name}>
                      <strong>{b.name}</strong> ({b.sales} ventas)
                      {b.others > 0 ? (
                        <span className="text-destructive">
                          {" "}
                          · {b.others} persona{b.others === 1 ? "" : "s"} más perderá{b.others === 1 ? "" : "n"} el acceso
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>No es dueño de ningún negocio: solo se quita su acceso a los negocios donde fue invitado.</p>
            )}
          </div>
          <Field label={`Para confirmar, escribe ${email}`} htmlFor={`del-${userId}`}>
            <Input
              id={`del-${userId}`}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              className="h-10"
              placeholder={email}
            />
          </Field>
          <Button type="submit" variant="destructive" size="lg" className="h-11 text-base" disabled={!matches || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Eliminar para siempre
          </Button>
        </form>
      </AppModal>
    </>
  )
}
