"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Download, Loader2, Trash2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { deleteMyAccount } from "@/server/actions/settings"

export type OwnedBusinessInfo = { name: string; sales: number; others: number }

/** Configuración → Tu cuenta: descargar todos los datos y eliminar la cuenta. */
export function AccountSection({ email, ownedBusinesses }: { email: string; ownedBusinesses: OwnedBusinessInfo[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [confirm, setConfirm] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [pending, startTransition] = React.useTransition()
  const matches = confirm.trim().toLowerCase() === email.toLowerCase()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!matches || !password) return
    startTransition(async () => {
      const r = await deleteMyAccount(confirm, password)
      if (!r.ok) return void toast.error(r.message)
      toast.success("Tu cuenta fue eliminada. ¡Gracias por haber usado OrdenSimple!")
      // La sesión ya no existe: volvemos a la portada.
      router.replace("/")
      router.refresh()
    })
  }

  return (
    <div className="divide-y">
      <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="font-medium">Descargar mis datos</p>
          <p className="text-sm text-muted-foreground">
            Un archivo con planillas de tus ventas, gastos, productos, clientes, fiado y cierres de caja. Se abren en Excel.
          </p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <a href="/dashboard/configuracion/mis-datos" download>
            <Download />
            Descargar
          </a>
        </Button>
      </div>
      <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="font-medium text-destructive">Eliminar mi cuenta</p>
          <p className="text-sm text-muted-foreground">Borra tu cuenta y tus negocios para siempre. Descarga tus datos antes.</p>
        </div>
        <Button
          variant="outline"
          className="shrink-0 text-destructive"
          onClick={() => {
            setConfirm("")
            setPassword("")
            setOpen(true)
          }}
        >
          <Trash2 />
          Eliminar cuenta
        </Button>
      </div>

      <AppModal open={open} onOpenChange={setOpen} title="Eliminar mi cuenta" description={email}>
        <form onSubmit={submit} className="grid gap-5">
          <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" />
              Esto no se puede deshacer.
            </p>
            <p>Se borrará tu cuenta y no podrás volver a entrar con ella.</p>
            {ownedBusinesses.length ? (
              <>
                <p>También se borrarán tus negocios, con todas sus ventas, gastos, productos, clientes y fiado:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {ownedBusinesses.map((b) => (
                    <li key={b.name}>
                      <strong>{b.name}</strong> ({b.sales} ventas)
                      {b.others > 0 ? (
                        <span className="text-destructive">
                          {" "}
                          · {b.others} persona{b.others === 1 ? "" : "s"} de tu equipo perderá{b.others === 1 ? "" : "n"} el acceso
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <p>
              ¿Quieres guardar una copia?{" "}
              <a href="/dashboard/configuracion/mis-datos" download className="font-medium text-primary underline-offset-4 hover:underline">
                Descarga tus datos
              </a>{" "}
              antes de continuar.
            </p>
          </div>
          <Field label={`Para confirmar, escribe tu correo: ${email}`} htmlFor="delete-me">
            <Input id="delete-me" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className="h-10" placeholder={email} />
          </Field>
          <Field label="Tu contraseña" htmlFor="delete-me-pass">
            <Input
              id="delete-me-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-10"
            />
          </Field>
          <Button type="submit" variant="destructive" size="lg" className="h-11 text-base" disabled={!matches || !password || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Eliminar mi cuenta para siempre
          </Button>
        </form>
      </AppModal>
    </div>
  )
}
