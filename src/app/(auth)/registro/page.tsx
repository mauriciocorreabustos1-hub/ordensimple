import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { RegisterForm } from "@/components/auth/register-form"
import { safeNext } from "@/lib/auth-errors"
import { formatMoney } from "@/lib/currency"
import { BILLING_ENABLED, checkoutPath, parsePlanChoice, PLAN_OF_CHOICE, PLANS } from "@/lib/plans"
import { getSession } from "@/server/session"

export const metadata: Metadata = { title: "Crear cuenta" }

export default async function RegisterPage({ searchParams }: PageProps<"/registro">) {
  const params = await searchParams
  const next = typeof params.next === "string" ? safeNext(params.next, "") : ""
  const email = typeof params.email === "string" ? params.email.slice(0, 200) : ""
  // Viene de "Elegir Pro / Empresa": se recuerda el plan para llevarlo a pagar al terminar.
  const choice = BILLING_ENABLED && !next ? parsePlanChoice(params.plan) : null
  const chosen = choice ? PLANS[PLAN_OF_CHOICE[choice]] : null
  if (await getSession()) redirect(choice ? checkoutPath(choice) : next || "/dashboard")

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center lg:text-left">
        <h1 className="text-2xl font-semibold tracking-tight">{chosen ? `Crea tu cuenta para contratar ${chosen.name}` : "Crea tu cuenta gratis"}</h1>
        <p className="text-sm text-muted-foreground">
          {next
            ? "Crea tu cuenta y te llevamos directo a la invitación."
            : chosen
              ? "Primero tu cuenta y los datos de tu negocio (2 minutos). Al terminar te llevamos a pagar con Mercado Pago."
              : "En 2 minutos tendrás tu negocio listo para usar."}
        </p>
      </div>
      {chosen?.monthlyPrice ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent/40 px-4 py-3 text-sm">
          <span>
            Elegiste <strong>{chosen.name}</strong>: {formatMoney(chosen.monthlyPrice, "CLP")} al mes
          </span>
          <Link href="/precios" className="shrink-0 text-xs text-primary hover:underline">
            Cambiar
          </Link>
        </div>
      ) : null}
      <RegisterForm
        next={next || (choice ? `/onboarding?plan=${choice}` : undefined)}
        defaultEmail={email || undefined}
        submitLabel={choice ? "Crear cuenta y continuar" : undefined}
      />
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={next || choice ? `/login?${new URLSearchParams({ next: next || checkoutPath(choice!) })}` : "/login"}
          className="font-medium text-primary hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
