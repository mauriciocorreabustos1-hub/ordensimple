"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field } from "@/components/app/field"
import { PasswordInput } from "@/components/auth/password-input"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage } from "@/lib/auth-errors"
import { resetPasswordSchema } from "@/lib/validations"

export function ResetPasswordForm({ token }: { token?: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[] | undefined>>({})

  if (!token) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          El enlace no es válido o ya expiró.{" "}
          <Link href="/recuperar-password" className="font-medium underline">
            Pide uno nuevo
          </Link>
          .
        </AlertDescription>
      </Alert>
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const parsed = resetPasswordSchema.safeParse({ password: form.get("password"), confirm: form.get("confirm") })
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors)
      return
    }
    setFieldErrors({})
    setPending(true)
    const { error } = await authClient.resetPassword({ newPassword: parsed.data.password, token })
    if (error) {
      setPending(false)
      setError(authErrorMessage(error))
      return
    }
    toast.success("Listo. Ya puedes entrar con tu nueva contraseña.")
    router.replace("/login")
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Nueva contraseña" htmlFor="password" error={fieldErrors.password?.[0]} hint="Mínimo 8 caracteres.">
        <PasswordInput id="password" name="password" autoComplete="new-password" />
      </Field>
      <Field label="Repite la contraseña" htmlFor="confirm" error={fieldErrors.confirm?.[0]}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Guardar contraseña
      </Button>
    </form>
  )
}
