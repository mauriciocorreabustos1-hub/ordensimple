"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { safeNext } from "@/lib/auth-errors"

type Mode = "email" | "app" | "backup"

/**
 * Segundo paso al iniciar sesión. Muestra solo lo que sirve para esa cuenta:
 * - correo: el código que le enviamos;
 * - app: el código de su app, o uno de sus códigos de respaldo.
 */
export function TwoFactorVerify({ next }: { next?: string }) {
  const router = useRouter()
  const [method, setMethod] = React.useState<"email" | "app" | "expired" | null>(null)
  const [mode, setMode] = React.useState<Mode>("email")
  const [code, setCode] = React.useState("")
  const [trust, setTrust] = React.useState(true)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)
  const [cooldown, setCooldown] = React.useState(false)

  const sendEmail = React.useCallback(async () => {
    setError(null)
    setCooldown(true)
    setTimeout(() => setCooldown(false), 30_000)
    const { error } = await authClient.twoFactor.sendOtp()
    if (error) return void setError("No pudimos enviar el código. Intenta de nuevo en un momento.")
    setSent(true)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/auth/dos-pasos/metodo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { method: null }))
      .catch(() => ({ method: null }))
      .then(({ method: m }: { method: "email" | "app" | null }) => {
        if (cancelled) return
        if (!m) return setMethod("expired")
        setMethod(m)
        setMode(m)
        if (m === "email") void sendEmail()
      })
    return () => {
      cancelled = true
    }
  }, [sendEmail])

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    const value = code.replace(/\s/g, "")
    if (!value) return setError("Escribe el código.")
    setPending(true)
    setError(null)
    const { error } =
      mode === "app"
        ? await authClient.twoFactor.verifyTotp({ code: value, trustDevice: trust })
        : mode === "backup"
          ? await authClient.twoFactor.verifyBackupCode({ code: value, trustDevice: trust })
          : await authClient.twoFactor.verifyOtp({ code: value, trustDevice: trust })
    if (error) {
      setPending(false)
      const msg = (error.message ?? "").toLowerCase()
      setError(
        msg.includes("expired") || msg.includes("invalid two factor cookie")
          ? "Pasó mucho rato. Vuelve a iniciar sesión."
          : msg.includes("locked") || msg.includes("too many")
            ? "Demasiados intentos. Espera unos minutos y vuelve a iniciar sesión."
            : "El código no es correcto. Revísalo e intenta de nuevo.",
      )
      return
    }
    router.replace(safeNext(next))
    router.refresh()
  }

  if (!method) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Preparando…
      </p>
    )
  }

  if (method === "expired") {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">Pasó mucho rato. Vuelve a iniciar sesión.</p>
        <Button asChild size="lg" className="h-11">
          <Link href="/login">Iniciar sesión</Link>
        </Button>
      </div>
    )
  }

  const switchTo = (m: Mode) => {
    setMode(m)
    setCode("")
    setError(null)
  }

  return (
    <form onSubmit={verify} className="grid gap-4" noValidate>
      <p className="text-sm text-pretty text-muted-foreground">
        {mode === "email"
          ? sent
            ? "Te enviamos un código de 6 números a tu correo. Vale por 5 minutos."
            : "Enviando el código a tu correo…"
          : mode === "app"
            ? "Abre tu app de códigos (por ejemplo Google Authenticator) y escribe el código de OrdenSimple."
            : "Escribe uno de tus códigos de respaldo. Cada uno sirve una sola vez."}
      </p>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode={mode === "backup" ? "text" : "numeric"}
        autoComplete="one-time-code"
        placeholder={mode === "backup" ? "xxxxx-xxxxx" : "123456"}
        aria-label="Código"
        className="h-12 text-center font-mono text-xl tracking-[0.3em]"
        autoFocus
        maxLength={mode === "backup" ? 20 : 6}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="size-4 accent-primary" />
        No pedir el código en este equipo por 30 días
      </label>
      {error ? (
        <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Entrar
      </Button>
      <div className="flex flex-col items-center gap-2 text-sm">
        {mode === "email" ? (
          <Button type="button" variant="link" className="h-auto p-0" disabled={cooldown} onClick={() => void sendEmail()}>
            {cooldown ? "Código enviado" : "Reenviar código"}
          </Button>
        ) : null}
        {method === "app" && mode === "app" ? (
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => switchTo("backup")}>
            Perdí mi celular: usar un código de respaldo
          </Button>
        ) : null}
        {mode === "backup" ? (
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => switchTo("app")}>
            Usar la app de códigos
          </Button>
        ) : null}
        <Link href="/login" className="text-muted-foreground hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    </form>
  )
}
