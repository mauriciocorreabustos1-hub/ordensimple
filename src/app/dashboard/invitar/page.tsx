import type { Metadata } from "next"
import { Gift, Sparkles, Trophy, UserPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/app/page-header"
import { ShareLink } from "@/components/referrals/share-link"
import { getAppUrl } from "@/lib/app-url"
import { formatDate } from "@/lib/dates"
import { PLANS } from "@/lib/plans"
import { referralShareText, triggerText } from "@/lib/referrals"
import { getReferralOverview } from "@/server/referrals"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Invita y gana" }

export default async function InvitePage() {
  const ctx = await requireBusiness()
  const { program, code, referrals } = await getReferralOverview(ctx.businessId)

  if (!program.enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invita y gana" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            El programa de invitaciones no está activo por ahora. Vuelve pronto.
          </CardContent>
        </Card>
      </div>
    )
  }

  const planName = PLANS[program.plan].name
  const url = `${getAppUrl()}/amigo/${code}`
  const when = triggerText(program.referrerTrigger, program.minSales)
  const earnedDays = referrals.reduce((t, r) => t + (r.referrerDays ?? 0), 0)
  const rewarded = referrals.filter((r) => (r.referrerDays ?? 0) > 0).length
  const reachedMax = program.maxRewards !== null && rewarded >= program.maxRewards
  const steps = [
    { icon: UserPlus, title: "1. Comparte tu enlace", text: "Por WhatsApp, en tus redes o a otros negocios del barrio." },
    {
      icon: Sparkles,
      title: "2. Tu amigo se registra",
      text:
        program.invitedDays > 0
          ? `Y recibe ${program.invitedDays} días gratis del plan ${planName}.`
          : "Y empieza a usar OrdenSimple gratis.",
    },
    {
      icon: Trophy,
      title: "3. Tú ganas",
      text:
        program.referrerDays > 0 ? `${program.referrerDays} días del plan ${planName}, ${when}.` : "Más negocios ordenados en tu barrio.",
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Invita y gana" description="Recomienda OrdenSimple a otros negocios y gana días gratis del plan Pro." />

      <Card className="overflow-hidden border-primary/30 bg-[radial-gradient(ellipse_at_top_left,var(--accent),transparent_70%)]">
        <CardHeader>
          <CardTitle className="flex items-start gap-2 text-xl text-balance">
            <Gift className="mt-0.5 size-5 shrink-0 text-primary" />
            {program.referrerDays > 0
              ? `Gana ${program.referrerDays} días del plan ${planName} por cada negocio que invites`
              : "Invita a otros negocios a ordenarse"}
          </CardTitle>
          <CardDescription className="text-pretty">
            {program.invitedDays > 0 ? `Tu amigo recibe ${program.invitedDays} días gratis del plan ${planName} al crear su negocio. ` : ""}
            {program.referrerDays > 0 ? `Tú ganas tus ${program.referrerDays} días ${when}.` : ""}
            {program.referrerDays > 0 ? " Si ya pagas tu suscripción, no se te cobra mientras duran tus días ganados." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShareLink url={url} message={referralShareText(url, program.invitedDays, planName)} />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.title} className="space-y-1.5 rounded-xl border bg-card p-4">
            <s.icon className="size-5 text-primary" />
            <p className="font-medium">{s.title}</p>
            <p className="text-sm text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tus invitados</CardTitle>
          <CardDescription>
            {referrals.length
              ? `${referrals.length} ${referrals.length === 1 ? "negocio se unió" : "negocios se unieron"} con tu enlace · ganaste ${earnedDays} días en total.`
              : "Aún nadie se ha unido con tu enlace. ¡Compártelo!"}
            {reachedMax ? ` Llegaste al máximo de ${program.maxRewards} recompensas.` : ""}
          </CardDescription>
        </CardHeader>
        {referrals.length ? (
          <CardContent>
            <ul className="divide-y">
              {referrals.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.referred.name}</span>
                    <span className="text-xs text-muted-foreground">Se unió el {formatDate(r.createdAt, ctx.timezone)}</span>
                  </span>
                  {(r.referrerDays ?? 0) > 0 ? (
                    <Badge className="border-success/30 bg-success/15 text-success">+{r.referrerDays} días</Badge>
                  ) : r.referrerRewardedAt ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      Sin días
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      {program.referrerTrigger === "VENTAS"
                        ? `Pendiente · ${Math.min(r.referred._count.sales, program.minSales)} de ${program.minSales} ventas`
                        : program.referrerTrigger === "PAGO"
                          ? "Pendiente · aún no paga"
                          : "Pendiente"}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        ) : null}
      </Card>
    </div>
  )
}
