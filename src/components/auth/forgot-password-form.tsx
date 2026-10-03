"use client"

import * as React from "react"
import { Loader2, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field } from "@/components/app/field"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage } from "@/lib/auth-errors"
import { forgotPasswordSchema } from "@/lib/validations"

export function ForgotPasswordForm() {
  const [pending, setPending] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const parsed = forgotPasswordSchema.safeParse({ email: new FormData(e.currentTarget).get("email") })
    if (!parsed.success) {
      setError("Ingresa un correo válido.")
      return
    }
    setPending(true)
    const { error } = await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo: "/restablecer-password",
    })
    setPending(false)
    // Siempre mostramos el mismo mensaje para no revelar qué correos tienen cuenta.
    if (error && error.status === 429) {
      setError(authErrorMessage(error))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center">
        <MailCheck className="size-8 text-primary" />
        <p className="font-medium">Revisa tu correo</p>
        <p className="text-sm text-muted-foreground">
          Si existe una cuenta con ese correo, te enviamos un enlace para crear una nueva contraseña. El enlace dura 1
          hora.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Correo de tu cuenta" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" className="h-10" placeholder="tu@correo.cl" />
      </Field>
      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Enviar enlace
      </Button>
    </form>
  )
}
