import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { safeNext } from "@/lib/auth-errors"
import { getSession } from "@/server/session"

export const metadata: Metadata = { title: "Iniciar sesión" }

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams
  if (await getSession()) redirect(safeNext(typeof next === "string" ? next : undefined))

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center lg:text-left">
        <h1 className="text-2xl font-semibold tracking-tight">Hola de nuevo 👋</h1>
        <p className="text-sm text-muted-foreground">Ingresa para ver cómo va tu negocio.</p>
      </div>
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href={typeof next === "string" && next.startsWith("/invitacion/") ? `/registro?${new URLSearchParams({ next })}` : "/registro"} className="font-medium text-primary hover:underline">
          Crea una gratis
        </Link>
      </p>
    </div>
  )
}
