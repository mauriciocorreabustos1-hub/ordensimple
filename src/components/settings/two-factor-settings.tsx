"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import QRCode from "qrcode"
import { Copy, KeyRound, Loader2, Mail, ShieldCheck, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { authClient } from "@/lib/auth-client"
import { setTwoFactorMethod } from "@/server/actions/settings"

type Step =
  | { kind: "closed" }
  | { kind: "password"; action: "email" | "app" | "disable" | "codes" }
  | { kind: "qr"; qr: string; secret: string; backupCodes: string[] }
  | { kind: "codes"; backupCodes: string[] }


/** Configuración → verificación en dos pasos: activar por correo o con app, ver códigos de respaldo o desactivar. */
export function TwoFactorSettings({ enabled, method, isAdmin }: { enabled: boolean; method: string | null; isAdmin: boolean }) {
  const router = useRouter()
  const [step, setStep] = React.useState<Step>({ kind: "closed" })
  const [password, setPassword] = React.useState("")
  const [code, setCode] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const close = () => {
    setStep({ kind: "closed" })
    setPassword("")
    setCode("")
  }

  async function withPassword(e: React.FormEvent) {
    e.preventDefault()
    if (step.kind !== "password") return
    setPending(true)
    try {
      if (step.action === "email") {
        const { error } = await authClient.twoFactor.enable({ password, method: "otp" } as never)
        if (error) return void toast.error(passwordError(error.message))
        await setTwoFactorMethod("email")
        toast.success("Listo: al iniciar sesión te pediremos un código que llega a tu correo.")
        close()
        router.refresh()
      } else if (step.action === "app") {
        const { data, error } = await authClient.twoFactor.enable({ password })
        if (error || !data || !("totpURI" in data)) return void toast.error(passwordError(error?.message))
        const uri = data.totpURI as string
        const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 })
        const secret = new URL(uri).searchParams.get("secret") ?? ""
        setStep({ kind: "qr", qr, secret, backupCodes: (data as { backupCodes?: string[] }).backupCodes ?? [] })
      } else if (step.action === "disable") {
        const { error } = await authClient.twoFactor.disable({ password })
        if (error) return void toast.error(passwordError(error.message))
        await setTwoFactorMethod(null)
        toast.success("Desactivaste la verificación en dos pasos.")
        close()
        router.refresh()
      } else {
        const { data, error } = await authClient.twoFactor.generateBackupCodes({ password })
        if (error || !data) return void toast.error(passwordError(error?.message))
        setStep({ kind: "codes", backupCodes: data.backupCodes })
      }
    } finally {
      setPending(false)
    }
  }

  async function confirmApp(e: React.FormEvent) {
    e.preventDefault()
    if (step.kind !== "qr") return
    setPending(true)
    const { error } = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, "") })
    setPending(false)
    if (error) return void toast.error("El código no es correcto. Revisa que sea el de OrdenSimple y que no haya cambiado.")
    await setTwoFactorMethod("app")
    toast.success("Listo: al iniciar sesión te pediremos el código de tu app.")
    setStep({ kind: "codes", backupCodes: step.backupCodes })
    router.refresh()
  }

  const methodLabel = method === "app" ? "con la app de códigos" : "con un código por correo"

  return (
    <div id="dos-pasos" className="scroll-mt-24 space-y-3">
      {enabled ? (
        <div className="flex flex-col gap-3 rounded-xl border border-success/30 bg-success/5 p-4 sm:flex-row sm:items-center">
          <ShieldCheck className="size-5 shrink-0 text-success" />
          <p className="flex-1 text-sm">
            <span className="font-medium">Activada {methodLabel}.</span>{" "}
            <span className="text-muted-foreground">Al iniciar sesión te pedimos la contraseña y un código.</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {method === "app" ? (
              <Button size="sm" variant="outline" onClick={() => setStep({ kind: "password", action: "codes" })}>
                <KeyRound />
                Nuevos códigos de respaldo
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setStep({ kind: "password", action: "disable" })}>
              Desactivar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-pretty text-muted-foreground">
            Además de tu contraseña, te pedimos un código al iniciar sesión. Si alguien te roba la contraseña, igual no puede entrar.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 p-3 text-left"
              onClick={() => setStep({ kind: "password", action: "email" })}
            >
              <Mail className="size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">Código por correo</span>
                <span className="block text-xs font-normal text-muted-foreground">Te llega a tu correo. No instalas nada.</span>
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 p-3 text-left"
              onClick={() => setStep({ kind: "password", action: "app" })}
            >
              <Smartphone className="size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">App de códigos</span>
                <span className="block text-xs font-normal text-muted-foreground">Google Authenticator u otra. La más segura.</span>
              </span>
            </Button>
          </div>
        </div>
      )}

      <AppModal
        open={step.kind === "password"}
        onOpenChange={(o) => !o && close()}
        title={step.kind === "password" && step.action === "disable" ? "Desactivar la verificación en dos pasos" : "Confirma tu contraseña"}
        description={
          step.kind === "password" && step.action === "disable" && isAdmin
            ? "Ojo: sin la verificación en dos pasos no podrás entrar al panel de administración."
            : "Por seguridad, escribe la contraseña con la que entras a OrdenSimple."
        }
      >
        <form onSubmit={withPassword} className="grid gap-4">
          <Field label="Contraseña" htmlFor="tf-pass">
            <Input
              id="tf-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10"
              autoFocus
            />
          </Field>
          <Button type="submit" className="h-11" disabled={pending || !password}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {step.kind === "password" && step.action === "disable" ? "Desactivar" : "Continuar"}
          </Button>
        </form>
      </AppModal>

      <AppModal open={step.kind === "qr"} onOpenChange={(o) => !o && close()} title="Conecta tu app de códigos">
        {step.kind === "qr" ? (
          <form onSubmit={confirmApp} className="grid gap-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Abre tu app de códigos (por ejemplo Google Authenticator).</li>
              <li>Toca “Agregar” y escanea este código.</li>
              <li>Escribe el código de 6 números que aparece.</li>
            </ol>
            {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada en el navegador */}
            <img
              src={step.qr}
              alt="Código QR para la app de códigos"
              width={220}
              height={220}
              className="mx-auto rounded-lg border bg-white p-2"
            />
            <p className="text-center text-xs text-muted-foreground">
              ¿No puedes escanear? Escribe esta clave en la app: <span className="font-mono break-all select-all">{step.secret}</span>
            </p>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              aria-label="Código de la app"
              className="h-12 text-center font-mono text-xl tracking-[0.3em]"
              maxLength={6}
            />
            <Button type="submit" className="h-11" disabled={pending || code.replace(/\s/g, "").length < 6}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Activar
            </Button>
          </form>
        ) : null}
      </AppModal>

      <AppModal open={step.kind === "codes"} onOpenChange={(o) => !o && close()} title="Guarda tus códigos de respaldo">
        {step.kind === "codes" ? (
          <div className="grid gap-4">
            <p className="text-sm text-pretty text-muted-foreground">
              Si pierdes el celular, entras con uno de estos códigos (cada uno sirve una vez). Guárdalos en un lugar seguro: no los
              volveremos a mostrar.
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-3 font-mono text-sm">
              {step.backupCodes.map((c) => (
                <li key={c} className="text-center">
                  {c}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="h-11"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(step.backupCodes.join("\n"))
                  toast.success("Códigos copiados")
                } catch {
                  toast.error("No se pudieron copiar. Anótalos a mano.")
                }
              }}
            >
              <Copy />
              Copiar códigos
            </Button>
            <Button className="h-11" onClick={close}>
              Ya los guardé
            </Button>
          </div>
        ) : null}
      </AppModal>
    </div>
  )
}

function passwordError(message?: string | null) {
  return /password/i.test(message ?? "") ? "La contraseña no es correcta." : "No se pudo completar. Intenta de nuevo."
}
