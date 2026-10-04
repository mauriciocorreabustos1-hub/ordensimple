import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Logo } from "@/components/app/logo"
import { SignOutButton } from "@/components/app/user-menu"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { getActiveMembership, requireUser } from "@/server/session"

export const metadata: Metadata = { title: "Configura tu negocio" }

export default async function OnboardingPage() {
  const user = await requireUser()
  const membership = await getActiveMembership(user.id, user.activeBusinessId as string | null | undefined)
  if (membership?.business.onboardingCompleted) redirect("/dashboard")

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <Logo href="/" />
        <SignOutButton compact />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-10 sm:items-center">
        <OnboardingWizard firstName={user.name.split(" ")[0]} />
      </main>
    </div>
  )
}
