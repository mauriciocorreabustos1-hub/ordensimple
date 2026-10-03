import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { RegisterForm } from "@/components/auth/register-form"
import { getSession } from "@/server/session"

export const metadata: Metadata = { title: "Crear cuenta" }

export default async function RegisterPage() {
  if (await getSession()) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Crea tu cuenta gratis</h1>
        <p className="text-sm text-muted-foreground">En 2 minutos tendrás tu negocio listo para usar.</p>
      </div>
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
