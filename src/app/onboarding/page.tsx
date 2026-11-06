import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Users } from "lucide-react"
import { Logo } from "@/components/app/logo"
import { SignOutButton } from "@/components/app/user-menu"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { AcceptInvitationButton } from "@/components/settings/accept-invitation-button"
import { db } from "@/lib/db"
import { BILLING_ENABLED, checkoutPath, parsePlanChoice } from "@/lib/plans"
import { ROLE_LABEL } from "@/lib/roles"
import { getActiveMembership, requireUser } from "@/server/session"

export const metadata: Metadata = { title: "Configura tu negocio" }

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser()
  const params = await searchParams
  const choice = BILLING_ENABLED ? parsePlanChoice(params.plan) : null
  const membership = await getActiveMembership(user.id, user.activeBusinessId as string | null | undefined)
  if (membership?.business.onboardingCompleted) redirect(choice ? checkoutPath(choice) : "/dashboard")

  // Un trabajador invitado no tiene que crear un negocio: si tiene invitaciones pendientes, entra con ellas.
  const invitations =
    params.crear === "1"
      ? []
      : await db.invitation.findMany({
          where: { email: user.email.toLowerCase(), acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          select: { token: true, batchId: true, role: true, business: { select: { name: true } } },
        })
  // Las invitaciones enviadas juntas (varias sucursales) se aceptan con un solo botón.
  const groups = new Map<string, { token: string; role: (typeof invitations)[number]["role"]; names: string[] }>()
  for (const inv of invitations) {
    const key = inv.batchId ?? inv.token
    const g = groups.get(key) ?? { token: inv.token, role: inv.role, names: [] }
    g.names.push(inv.business.name)
    groups.set(key, g)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <Logo href="/" />
        <SignOutButton compact />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-10 sm:items-center">
        {groups.size ? (
          <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="size-6" />
            </span>
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight">
                ¡Hola, {user.name.split(" ")[0]}! Te invitaron a trabajar en OrdenSimple
              </h1>
              <p className="text-sm text-muted-foreground">No necesitas crear un negocio: entra directo al negocio que te invitó.</p>
            </div>
            <ul className="space-y-3">
              {[...groups.values()].map((g) => {
                const name = g.names.length > 1 ? `${g.names.length} sucursales` : g.names[0]
                return (
                  <li key={g.token} className="space-y-3 rounded-xl border p-4">
                    <div>
                      <p className="font-medium">{name}</p>
                      {g.names.length > 1 ? <p className="text-xs text-muted-foreground">{g.names.join(" · ")}</p> : null}
                      <p className="text-xs text-muted-foreground">Entrarás como {ROLE_LABEL[g.role]}</p>
                    </div>
                    <AcceptInvitationButton token={g.token} businessName={name} />
                  </li>
                )
              })}
            </ul>
            <p className="text-center text-xs text-muted-foreground">
              ¿Además tienes tu propio negocio?{" "}
              <Link href={`/onboarding?${new URLSearchParams({ crear: "1", ...(choice ? { plan: choice } : {}) })}`} className="text-primary hover:underline">
                Crear mi negocio
              </Link>
            </p>
          </div>
        ) : (
          <OnboardingWizard userId={user.id} firstName={user.name.split(" ")[0]} planChoice={choice ?? undefined} />
        )}
      </main>
    </div>
  )
}
