"use client"

import * as React from "react"
import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addAdmin, removeAdmin } from "@/server/actions/admin"

export type AdminRow = {
  email: string
  owner: boolean
  name: string | null
  /** null = todavía no crea su cuenta */
  verified: boolean | null
  twoFactor: boolean | null
}

/** Administradores: los dueños (Vercel) no se pueden quitar; los demás se agregan y quitan aquí. */
export function AdminsManager({ admins, canManage }: { admins: AdminRow[]; canManage: boolean }) {
  const [email, setEmail] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  function add(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await addAdmin(email)
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message ?? "Administrador agregado")
      setEmail("")
    })
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-xl border bg-card">
        {admins.map((a) => (
          <li key={a.email} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium break-all">{a.name ?? a.email}</span>
                {a.owner ? <Badge variant="secondary">Dueño</Badge> : null}
              </p>
              <p className="text-xs text-muted-foreground break-all">
                {a.name ? `${a.email} · ` : ""}
                {a.verified === null
                  ? "Aún no crea su cuenta"
                  : !a.verified
                    ? "Falta confirmar su correo"
                    : a.twoFactor
                      ? "Puede entrar al panel"
                      : "Falta activar la verificación en dos pasos"}
              </p>
            </div>
            {a.owner || !canManage ? null : (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(`¿Quitar a ${a.email} como administrador? Su cuenta sigue igual, solo pierde el acceso al panel.`))
                    return
                  startTransition(async () => {
                    const r = await removeAdmin(a.email)
                    if (r.ok) toast.success(r.message ?? "Listo")
                    else toast.error(r.message)
                  })
                }}
              >
                <Trash2 />
                Quitar
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canManage ? (
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.cl"
            aria-label="Correo del nuevo administrador"
            className="h-10"
            required
          />
          <Button type="submit" className="h-10" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
            Agregar administrador
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Solo el dueño puede agregar o quitar administradores.</p>
      )}
      <p className="flex gap-2 text-sm text-pretty text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        Para entrar al panel, cada administrador necesita una cuenta con ese correo, el correo confirmado y la verificación en dos pasos
        activada (en Configuración).
      </p>
    </div>
  )
}
