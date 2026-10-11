"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field } from "@/components/app/field"
import { PasswordInput } from "@/components/auth/password-input"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage, safeNext } from "@/lib/auth-errors"
import { loginSchema } from "@/lib/validations"

// Solo se guarda el correo (nunca la contraseña) y solo si la persona marcó "Recordarme".
const REMEMBERED_EMAIL_KEY = "ordensimple:correo"

function readRememberedEmail() {
  try {
    return window.localStorage.getItem(REMEMBERED_EMAIL_KEY)
  } catch {
    return null
  }
}

function writeRememberedEmail(email: string | null) {
  try {
    if (email) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email)
    else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY)
  } catch {
    // Navegación privada o almacenamiento bloqueado: no pasa nada.
  }
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const emailRef = React.useRef<HTMLInputElement>(null)
  const passwordRef = React.useRef<HTMLInputElement>(null)
  const [remember, setRemember] = React.useState(true)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[] | undefined>>({})

  // Si la persona pidió que la recordáramos, dejamos su correo escrito y el cursor en la contraseña.
  React.useEffect(() => {
    const saved = readRememberedEmail()
    if (saved && emailRef.current && !emailRef.current.value) {
      emailRef.current.value = saved
      passwordRef.current?.focus()
    }
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") })
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors)
      return
    }
    setFieldErrors({})
    setPending(true)
    // rememberMe = false: la sesión termina al cerrar el navegador.
    const { data, error } = await authClient.signIn.email({ ...parsed.data, rememberMe: remember })
    if (error) {
      setPending(false)
      setError(authErrorMessage(error))
      return
    }
    writeRememberedEmail(remember ? parsed.data.email : null)
    // Cuenta con verificación en dos pasos: falta el código.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      router.replace(`/verificar?${new URLSearchParams({ next: safeNext(next) })}`)
      return
    }
    router.replace(safeNext(next))
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Correo" htmlFor="email" error={fieldErrors.email?.[0]}>
        <Input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="h-10"
          placeholder="tu@correo.cl"
        />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={fieldErrors.password?.[0]}>
        <PasswordInput ref={passwordRef} id="password" name="password" autoComplete="current-password" />
      </Field>
      <div className="-mt-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
            Recordarme
          </Label>
        </div>
        <Link href="/recuperar-password" className="text-sm text-primary hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Iniciar sesión
      </Button>
      {!remember ? (
        <p className="-mt-1 text-center text-xs text-muted-foreground">
          Tu sesión se cerrará al cerrar el navegador. Ideal en computadores compartidos.
        </p>
      ) : null}
    </form>
  )
}
