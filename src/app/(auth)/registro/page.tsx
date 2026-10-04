import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { RegisterForm } from "@/components/auth/register-form"
import { safeNext } from "@/lib/auth-errors"
import { getSession } from "@/server/session"

export const metadata: Metadata = { title: "Crear cuenta" }

export default async function RegisterPage({ searchParams }: PageProps<"/registro">) {
  const params = await searchParams
  const next = typeof params.next === "string" ? safeNext(params.next, "") : ""
  const email = typeof params.email === "string" ? params.email.slice(0, 200) : ""
  if (await getSession()) redirect(next || "/dashboard")

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Crea tu cuenta gratis</h1>
        <p className="text-sm text-muted-foreground">
          {next ? "Crea tu cuenta y te llevamos directo a la invitación." : "En 2 minutos tendrás tu negocio listo para usar."}
        </p>
      </div>
      <RegisterForm next={next || undefined} defaultEmail={email || undefined} />
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href={next ? `/login?${new URLSearchParams({ next })}` : "/login"} className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
