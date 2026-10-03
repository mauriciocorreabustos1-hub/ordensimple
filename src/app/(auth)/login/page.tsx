import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { getSession } from "@/server/session"

export const metadata: Metadata = { title: "Iniciar sesión" }

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSession()) redirect("/dashboard")
  const { next } = await searchParams

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Hola de nuevo 👋</h1>
        <p className="text-sm text-muted-foreground">Ingresa para ver cómo va tu negocio.</p>
      </div>
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-primary hover:underline">
          Crea una gratis
        </Link>
      </p>
    </div>
  )
}
