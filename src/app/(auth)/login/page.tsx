import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { safeNext } from "@/lib/auth-errors"
import { getSession } from "@/server/session"
import { GoogleButton, OrDivider } from "@/components/auth/google-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { showGoogle } from "@/server/google-auth"

// Lo que puede salir mal al volver de Google (llega como ?error= en la dirección).
function googleError(code: string) {
  const c = code.toUpperCase()
  if (c === "GOOGLE_TWO_FACTOR") return "Tu cuenta tiene verificación en dos pasos: ingresa con tu correo y contraseña, y luego tu código."
  if (c === "GOOGLE_EMAIL_NOT_CONFIRMED")
    return "Ya hay una cuenta con ese correo que aún no se confirma. Ingresa con tu contraseña (o usa “¿Olvidaste tu contraseña?”) y confirma tu correo; después podrás entrar con Google."
  if (c === "ACCESS_DENIED") return "Cancelaste el ingreso con Google. Puedes intentarlo de nuevo o entrar con tu correo."
  return "No pudimos completar el ingreso con Google. Inténtalo de nuevo o entra con tu correo y contraseña."
}

export const metadata: Metadata = { title: "Iniciar sesión" }

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams
  if (await getSession()) redirect(safeNext(typeof next === "string" ? next : undefined))
  const nextPath = typeof next === "string" ? safeNext(next) : "/dashboard"
  const google = await showGoogle()

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center lg:text-left">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Hola de nuevo</h1>
        <p className="text-sm text-muted-foreground">Ingresa para ver cómo va tu negocio.</p>
      </div>
      {typeof error === "string" ? (
        <Alert variant="destructive">
          <AlertDescription>{googleError(error)}</AlertDescription>
        </Alert>
      ) : null}
      {google ? (
        <>
          {/* Quien no tenía cuenta queda registrado: va a configurar su negocio (o a la invitación que abrió). */}
          <GoogleButton callbackURL={nextPath} newUserCallbackURL={nextPath.startsWith("/invitacion/") ? nextPath : "/onboarding"} termsNote />
          <OrDivider />
        </>
      ) : null}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href={typeof next === "string" && next.startsWith("/invitacion/") ? `/registro?${new URLSearchParams({ next })}` : "/registro"} className="font-medium text-primary hover:underline">
          Crea una gratis
        </Link>
      </p>
    </div>
  )
}
