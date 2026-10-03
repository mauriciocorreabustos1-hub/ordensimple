import type { Metadata } from "next"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export const metadata: Metadata = { title: "Nueva contraseña" }

export default async function ResetPasswordPage({ searchParams }: PageProps<"/restablecer-password">) {
  const { token, error } = await searchParams
  const validToken = typeof token === "string" && !error ? token : undefined

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Crea una nueva contraseña</h1>
        <p className="text-sm text-muted-foreground">Elige una contraseña que no uses en otros sitios.</p>
      </div>
      <ResetPasswordForm token={validToken} />
    </div>
  )
}
