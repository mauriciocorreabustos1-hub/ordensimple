import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { RegisterForm } from "@/components/auth/register-form"
import { safeNext } from "@/lib/auth-errors"
import { formatMoney } from "@/lib/currency"
import { BILLING_ENABLED, checkoutPath, parsePlanChoice, PLAN_OF_CHOICE, PLANS } from "@/lib/plans"
import { getSession } from "@/server/session"
import { GoogleButton, OrDivider } from "@/components/auth/google-button"
import { showGoogle } from "@/server/google-auth"
import { cookies } from "next/headers"
import { Gift } from "lucide-react"
import { REFERRAL_COOKIE } from "@/lib/referrals"
import { findReferrerByCode, findSpecialLink, getReferralProgram } from "@/server/referrals"

export const metadata: Metadata = { title: "Crear cuenta" }

export default async function RegisterPage({ searchParams }: PageProps<"/registro">) {
  const params = await searchParams
  const next = typeof params.next === "string" ? safeNext(params.next, "") : ""
  const email = typeof params.email === "string" ? params.email.slice(0, 200) : ""
  // Viene de "Elegir Pro / Empresa": se recuerda el plan para llevarlo a pagar al terminar.
  const choice = BILLING_ENABLED && !next ? parsePlanChoice(params.plan) : null
  const chosen = choice ? PLANS[PLAN_OF_CHOICE[choice]] : null
  if (await getSession()) redirect(choice ? checkoutPath(choice) : next || "/dashboard")
  // Llegó con el enlace de un amigo: se le muestra quién lo invitó y su regalo.
  const inviteCode = (await cookies()).get(REFERRAL_COOKIE)?.value
  const special = next ? null : await findSpecialLink(inviteCode)
  const [referrer, program] = special ? [null, null] : await Promise.all([findReferrerByCode(inviteCode), getReferralProgram()])
  const invitedBy = referrer && program?.enabled && !next ? referrer : null
  const google = await showGoogle()
  // A dónde va después de registrarse con Google: lo mismo que con el formulario.
  const afterSignup = next || (choice ? `/onboarding?plan=${choice}` : "/onboarding")

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center lg:text-left">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {chosen ? `Crea tu cuenta para contratar ${chosen.name}` : "Crea tu cuenta gratis"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {next
            ? "Crea tu cuenta y te llevamos directo a la invitación."
            : chosen
              ? "Primero tu cuenta y los datos de tu negocio (2 minutos). Al terminar te llevamos a pagar con Mercado Pago."
              : "En 2 minutos tendrás tu negocio listo para usar."}
        </p>
      </div>
      {special && special.days > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-accent/40 px-4 py-3 text-sm">
          <Gift className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            ¡Tienes un regalo! Al crear tu negocio tienes{" "}
            <strong>
              {special.days} días gratis del plan {PLANS[special.plan].name}
            </strong>
            .
          </span>
        </div>
      ) : null}
      {invitedBy && program ? (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-accent/40 px-4 py-3 text-sm">
          <Gift className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <strong className="break-words">{invitedBy.name}</strong> te invitó a OrdenSimple.
            {program.invitedDays > 0
              ? ` Al crear tu negocio tienes ${program.invitedDays} días gratis del plan ${PLANS[program.plan].name}.`
              : null}{" "}
            {/* Enlace normal: /amigo/quitar es una redirección del servidor que borra la invitación guardada. */}
            <a
              href={choice ? `/amigo/quitar?plan=${choice}` : "/amigo/quitar"}
              className="text-xs whitespace-nowrap text-muted-foreground underline hover:text-foreground"
            >
              ¿No te invitó nadie? Quitar
            </a>
          </span>
        </div>
      ) : null}
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
      {google ? (
        <>
          <GoogleButton callbackURL={next || (choice ? checkoutPath(choice) : "/dashboard")} newUserCallbackURL={afterSignup} />
          <OrDivider label="o crea tu cuenta con tu correo" />
        </>
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
