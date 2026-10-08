"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, MailCheck, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"

const CALLBACK = "/dashboard?correo=confirmado"
const HIDE_KEY = "confirmar-correo-oculto-hasta"

/** Aviso para confirmar el correo: reenviar el enlace o corregir el correo si quedó mal escrito. Se puede ocultar 1 día. */
export function EmailVerifyBanner({ email }: { email: string }) {
  const router = useRouter()
  const [hidden, setHidden] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [newEmail, setNewEmail] = React.useState(email)
  const [pending, setPending] = React.useState(false)
  // Después de enviar, el botón espera 1 minuto antes de permitir otro envío.
  const [cooldown, setCooldown] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const startCooldown = () => {
    setSent(true)
    setCooldown(true)
    setTimeout(() => setCooldown(false), 60_000)
  }

  React.useEffect(() => {
    try {
      // Se lee después de montar para que el servidor y el navegador dibujen lo mismo la primera vez.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Number(localStorage.getItem(HIDE_KEY) ?? 0) > Date.now()) setHidden(true)
    } catch {}
  }, [])

  if (hidden) return null

  async function resend() {
    setPending(true)
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: CALLBACK })
    setPending(false)
    if (error) return void toast.error(error.status === 429 ? "Ya te mandamos varios correos. Espera un rato e intenta de nuevo." : "No pudimos enviar el correo. Intenta de nuevo.")
    startCooldown()
    toast.success(`Te mandamos el enlace a ${email}. Revisa también la carpeta de spam.`)
  }

  async function change(e: React.FormEvent) {
    e.preventDefault()
    const value = newEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return void toast.error("Revisa que el correo esté bien escrito.")
    if (value === email) return void setEditing(false)
    setPending(true)
    const { error } = await authClient.changeEmail({ newEmail: value, callbackURL: CALLBACK })
    if (error) {
      setPending(false)
      return void toast.error(error.status === 429 ? "Intentaste varias veces. Espera un rato." : (error.message ?? "No pudimos cambiar el correo. Puede que ya esté en uso."))
    }
    await authClient.sendVerificationEmail({ email: value, callbackURL: CALLBACK })
    setPending(false)
    setEditing(false)
    startCooldown()
    toast.success(`Listo: tu correo ahora es ${value}. Te mandamos el enlace para confirmarlo.`)
    router.refresh()
  }

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm sm:flex-row sm:items-center">
      <MailCheck className="size-5 shrink-0 text-warning" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">Confirma tu correo</p>
        {editing ? (
          <form onSubmit={change} className="flex flex-wrap gap-2 pt-1">
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-9 max-w-xs bg-background" aria-label="Correo correcto" autoFocus />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Guardar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </form>
        ) : (
          <p className="text-muted-foreground">
            Te mandamos un enlace a <strong className="text-foreground break-all">{email}</strong>. Confírmalo para asegurarte de que te lleguen tus
            avisos y poder recuperar tu cuenta si olvidas la contraseña.
          </p>
        )}
      </div>
      {editing ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="bg-background" disabled={pending || cooldown} onClick={resend}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {sent ? "Enviado" : "Reenviar correo"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Corregir correo
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Recordármelo mañana"
            title="Recordármelo mañana"
            onClick={() => {
              setHidden(true)
              try {
                localStorage.setItem(HIDE_KEY, String(Date.now() + 86_400_000))
              } catch {}
            }}
          >
            <X />
          </Button>
        </div>
      )}
    </div>
  )
}

/** Al volver desde el enlace del correo (?correo=confirmado): mensaje de éxito y se limpia la dirección. */
export function EmailConfirmedToast() {
  React.useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get("correo") !== "confirmado") return
    toast.success("¡Correo confirmado! Ya te llegarán tus avisos.")
    url.searchParams.delete("correo")
    window.history.replaceState(null, "", url.pathname + url.search + url.hash)
  }, [])
  return null
}
