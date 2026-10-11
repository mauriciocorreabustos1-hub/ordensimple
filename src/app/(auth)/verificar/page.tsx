import type { Metadata } from "next"
import { TwoFactorVerify } from "@/components/auth/two-factor-verify"

export const metadata: Metadata = { title: "Verificación en dos pasos" }

export default async function VerifyPage({ searchParams }: PageProps<"/verificar">) {
  const { next } = await searchParams
  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center lg:text-left">
        <h1 className="text-2xl font-semibold tracking-tight">Un paso más</h1>
        <p className="text-sm text-muted-foreground">Escribe tu código para entrar.</p>
      </div>
      <TwoFactorVerify next={typeof next === "string" ? next : undefined} />
    </div>
  )
}
