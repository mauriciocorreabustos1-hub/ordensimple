"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field } from "@/components/app/field"
import { PasswordInput } from "@/components/auth/password-input"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage, safeNext } from "@/lib/auth-errors"
import { registerSchema } from "@/lib/validations"

/** next: a dónde ir después de crear la cuenta (por ejemplo, una invitación). Sin next, va a configurar su negocio. */
export function RegisterForm({
  next,
  defaultEmail,
  submitLabel = "Crear cuenta gratis",
}: {
  next?: string
  defaultEmail?: string
  submitLabel?: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [marketing, setMarketing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[] | undefined>>({})

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const parsed = registerSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      marketingOptIn: marketing,
    })
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors)
      return
    }
    setFieldErrors({})
    setPending(true)
    // El enlace para confirmar el correo (en la bienvenida) vuelve al negocio.
    const { error } = await authClient.signUp.email({ ...parsed.data, callbackURL: "/dashboard?correo=confirmado" })
    if (error) {
      setPending(false)
      setError(authErrorMessage(error))
      return
    }
    router.replace(next ? safeNext(next, "/onboarding") : "/onboarding")
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Tu nombre" htmlFor="name" error={fieldErrors.name?.[0]}>
        <Input id="name" name="name" autoComplete="name" className="h-10" placeholder="María González" />
      </Field>
      <Field label="Correo" htmlFor="email" error={fieldErrors.email?.[0]}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="h-10"
          placeholder="tu@correo.cl"
          defaultValue={defaultEmail}
        />
      </Field>
      <Field
        label="Contraseña"
        htmlFor="password"
        error={fieldErrors.password?.[0]}
        hint="Mínimo 8 caracteres."
      >
        <PasswordInput id="password" name="password" autoComplete="new-password" />
      </Field>
      <div className="flex items-start gap-2.5">
        <Checkbox id="marketing" checked={marketing} onCheckedChange={(v) => setMarketing(v === true)} className="mt-0.5" />
        <Label htmlFor="marketing" className="cursor-pointer text-sm leading-snug font-normal text-muted-foreground">
          Quiero recibir novedades, consejos y ofertas de OrdenSimple por correo (puedes desactivarlo cuando quieras).
        </Label>
      </div>
      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {submitLabel}
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Al crear tu cuenta aceptas los{" "}
        <Link href="/terminos" target="_blank" className="text-primary underline-offset-4 hover:underline">
          Términos y condiciones
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" target="_blank" className="text-primary underline-offset-4 hover:underline">
          Política de privacidad
        </Link>
        .
      </p>
    </form>
  )
}
