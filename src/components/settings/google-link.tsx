"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

const BACK = "/dashboard/configuracion?seccion=cuenta"

// Lo que puede salir mal al volver de Google (llega como ?error= en la dirección).
function linkError(code: string) {
  const c = code.toLowerCase()
  if (c === "email_does_not_match") return "Esa cuenta de Google tiene otro correo. Elige la cuenta de Google con el mismo correo de OrdenSimple."
  if (c === "account_already_linked_to_different_user") return "Esa cuenta de Google ya está vinculada a otra cuenta de OrdenSimple."
  if (c === "google_email_not_confirmed") return "Primero confirma tu correo con el enlace que te enviamos; después podrás vincular Google."
  if (c === "access_denied") return "Cancelaste la vinculación con Google."
  return "No pudimos vincular tu cuenta con Google. Inténtalo de nuevo."
}

/**
 * Configuración, sección Tu cuenta: vincular la cuenta con Google para entrar con "Continuar con Google".
 * - Solo se vincula una cuenta de Google con el mismo correo (lo exige el servidor).
 * - Desvincular solo se ofrece si la cuenta tiene contraseña: si no, la persona se quedaría sin forma de entrar.
 */
export function GoogleLink({
  googleAccountId,
  hasPassword,
  emailVerified,
  twoFactor,
  inDesktopApp,
  status,
}: {
  /** El identificador de la cuenta de Google vinculada (null si no hay). */
  googleAccountId: string | null
  hasPassword: boolean
  emailVerified: boolean
  twoFactor: boolean
  inDesktopApp: boolean
  /** "vinculado" al volver de Google con éxito, o el código de error. */
  status?: { ok: true } | { error: string }
}) {
  const router = useRouter()
  const linked = googleAccountId !== null
  const [pending, setPending] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [error, setError] = React.useState(status && "error" in status ? linkError(status.error) : null)

  // Al volver de Google: se avisa y se limpia la dirección para que el aviso no se repita al recargar.
  React.useEffect(() => {
    if (!status) return
    if ("ok" in status) toast.success("Tu cuenta quedó vinculada con Google")
    window.history.replaceState(null, "", `${BACK}#google`)
  }, [status])

  async function link() {
    setPending(true)
    setError(null)
    const { error } = await authClient.linkSocial({
      provider: "google",
      callbackURL: `${BACK}&google=vinculado#google`,
      errorCallbackURL: `${BACK}#google`,
    })
    if (error) {
      setPending(false)
      setError("No se pudo abrir Google. Revisa tu conexión e inténtalo de nuevo.")
    }
  }

  async function unlink() {
    setPending(true)
    const { error } = await authClient.unlinkAccount({ accountId: googleAccountId ?? "" })
    setPending(false)
    setConfirming(false)
    if (error) {
      setError("No pudimos desvincular Google. Inténtalo de nuevo.")
      return
    }
    toast.success("Desvinculaste tu cuenta de Google")
    router.refresh()
  }

  return (
    <div id="google" className="scroll-mt-20 space-y-3 border-t pt-6">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 font-semibold">
          <GoogleMark />
          Vincular con Google
        </h3>
        <p className="text-sm text-pretty text-muted-foreground">
          {linked
            ? "Puedes entrar con el botón “Continuar con Google”, sin escribir tu contraseña."
            : "Entra con un toque usando tu cuenta de Google, sin escribir tu contraseña. Debe ser la cuenta de Google con tu mismo correo."}
        </p>
      </div>

      {linked ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-accent/40 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4 text-primary" />
            Vinculada con Google
          </span>
          {hasPassword && !confirming ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} disabled={pending}>
              Desvincular
            </Button>
          ) : null}
        </div>
      ) : inDesktopApp ? (
        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Para vincular tu cuenta, abre OrdenSimple en el navegador (www.ordensimple.cl) y vuelve a esta sección. Google no permite hacerlo
          dentro de la app de Windows.
        </p>
      ) : (
        <div className="space-y-2">
          <Button variant="outline" className="bg-card" onClick={link} disabled={pending || !emailVerified}>
            {pending ? <Loader2 className="animate-spin" /> : <GoogleMark />}
            Vincular con Google
          </Button>
          {!emailVerified ? (
            <p className="text-sm text-muted-foreground">Primero confirma tu correo con el enlace que te enviamos.</p>
          ) : null}
        </div>
      )}

      {confirming ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm">Ya no podrás entrar con Google; seguirás entrando con tu correo y contraseña.</p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={unlink} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Desvincular Google
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {linked && !hasPassword ? (
        <p className="text-xs text-muted-foreground">
          Tu cuenta no tiene contraseña: entras solo con Google. Si quieres una, usa “¿Olvidaste tu contraseña?” al iniciar sesión.
        </p>
      ) : null}
      {linked && twoFactor ? (
        <p className="text-xs text-muted-foreground">
          Como tienes activada la verificación en dos pasos, después de elegir tu cuenta de Google se te pedirá tu código.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
