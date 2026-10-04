import type { Metadata } from "next"
import Link from "next/link"
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SignOutButton } from "@/components/app/user-menu"
import { AcceptInvitationButton } from "@/components/settings/accept-invitation-button"
import { db } from "@/lib/db"
import { ROLE_LABEL } from "@/lib/roles"
import { getSession } from "@/server/session"

export const metadata: Metadata = {
  title: "Invitación",
  robots: { index: false, follow: false },
}

const ROLE_HELP = {
  OWNER: "",
  ADMIN: "Podrás registrar, editar y borrar ventas y gastos, manejar productos y ver reportes.",
  EMPLOYEE: "Podrás registrar ventas y gastos, el inventario y los clientes.",
} as const

export default async function InvitationPage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params
  const [invitation, session] = await Promise.all([
    db.invitation.findUnique({
      where: { token },
      include: { business: { select: { name: true } } },
    }),
    getSession(),
  ])

  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Esta invitación ya no es válida</h1>
        <p className="text-sm text-muted-foreground">
          Puede que ya se haya usado, que haya vencido (duran 7 días) o que la hayan cancelado. Pídele a quien te invitó que
          te envíe una nueva.
        </p>
        <Button asChild variant="outline">
          <Link href={session ? "/dashboard" : "/login"}>{session ? "Ir a mi panel" : "Iniciar sesión"}</Link>
        </Button>
      </div>
    )
  }

  const back = `/invitacion/${token}`
  const sameEmail = session?.user.email.toLowerCase() === invitation.email

  return (
    <div className="space-y-6">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Users className="size-6" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Te invitaron a {invitation.business.name}</h1>
        <p className="text-sm text-muted-foreground">
          Entrarás como <strong className="text-foreground">{ROLE_LABEL[invitation.role]}</strong>. {ROLE_HELP[invitation.role]}
        </p>
      </div>

      {session ? (
        sameEmail ? (
          <AcceptInvitationButton token={token} businessName={invitation.business.name} />
        ) : (
          <div className="space-y-3 rounded-xl border bg-muted/40 p-4 text-sm">
            <p>
              Esta invitación es para <strong>{invitation.email}</strong>, pero entraste como{" "}
              <strong>{session.user.email}</strong>. Cierra sesión y entra con el correo invitado.
            </p>
            <SignOutButton className="-ml-3" />
          </div>
        )
      ) : (
        <div className="grid gap-3">
          <Button asChild size="lg" className="h-11 text-base">
            <Link href={`/registro?${new URLSearchParams({ next: back, email: invitation.email })}`}>
              Crear mi cuenta con {invitation.email}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 text-base">
            <Link href={`/login?${new URLSearchParams({ next: back })}`}>Ya tengo cuenta, iniciar sesión</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
