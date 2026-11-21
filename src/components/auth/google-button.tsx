"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

/**
 * "Continuar con Google": lleva a la página de Google y vuelve ya con la sesión iniciada.
 * - callbackURL: a dónde va quien ya tenía cuenta.
 * - newUserCallbackURL: a dónde va quien se registra recién (normalmente, a configurar su negocio).
 * Si algo falla, Google devuelve a /login con el motivo y ahí se explica (ver googleError en la página de login).
 */
export function GoogleButton({
  callbackURL,
  newUserCallbackURL,
  termsNote,
}: {
  callbackURL: string
  newUserCallbackURL: string
  /** En el inicio de sesión: avisa que, si no tenía cuenta, se crea una y acepta los términos. */
  termsNote?: boolean
}) {
  const [pending, setPending] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  async function onClick() {
    setPending(true)
    setFailed(false)
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      newUserCallbackURL,
      errorCallbackURL: "/login",
    })
    // Si todo va bien, el navegador ya se fue a Google; si no, se avisa aquí mismo.
    if (error) {
      setPending(false)
      setFailed(true)
    }
  }

  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" size="lg" className="h-11 bg-card text-base" onClick={onClick} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <GoogleMark />}
        Continuar con Google
      </Button>
      {termsNote ? (
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Si aún no tienes cuenta, se crea una y aceptas los{" "}
          <Link href="/terminos" target="_blank" className="text-primary underline-offset-4 hover:underline">
            Términos y condiciones
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" target="_blank" className="text-primary underline-offset-4 hover:underline">
            Política de privacidad
          </Link>
          .
        </p>
      ) : null}
      {failed ? <p className="text-center text-sm text-destructive">No se pudo abrir Google. Revisa tu conexión e inténtalo de nuevo.</p> : null}
    </div>
  )
}

/** Separador entre Google y el formulario con correo. */
export function OrDivider({ label = "o con tu correo" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

/** La "G" de Google con sus colores, como piden sus normas para este botón. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
