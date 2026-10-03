"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field } from "@/components/app/field"
import { PasswordInput } from "@/components/auth/password-input"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage, safeNext } from "@/lib/auth-errors"
import { loginSchema } from "@/lib/validations"

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[] | undefined>>({})

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
    const { error } = await authClient.signIn.email(parsed.data)
    if (error) {
      setPending(false)
      setError(authErrorMessage(error))
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
        <Input id="email" name="email" type="email" autoComplete="email" className="h-10" placeholder="tu@correo.cl" />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={fieldErrors.password?.[0]}>
        <PasswordInput id="password" name="password" autoComplete="current-password" />
      </Field>
      <div className="-mt-1 text-right">
        <Link href="/recuperar-password" className="text-sm text-primary hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Iniciar sesión
      </Button>
    </form>
  )
}
