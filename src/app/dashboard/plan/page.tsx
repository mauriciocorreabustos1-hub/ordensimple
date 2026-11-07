import type { Metadata } from "next"
import { headers } from "next/headers"
import { Crown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/app/page-header"
import { RedeemCoupon } from "@/components/settings/redeem-coupon"
import { SubscriptionPanel, type PlanOption, type SubscriptionState } from "@/components/settings/subscription-panel"
import { formatMoney } from "@/lib/currency"
import { formatDate } from "@/lib/dates"
import { db } from "@/lib/db"
import { mercadoPagoConfigured } from "@/lib/mercadopago"
import { BILLING_ENABLED, discountedPrice, PAID_PLANS, parsePlanChoice, PLAN_OF_CHOICE, PLANS } from "@/lib/plans"
import { requireBusiness, requirePermission } from "@/server/session"
import { isMobileStoreAppUserAgent } from "@/lib/native-app"

export const metadata: Metadata = { title: "Tu plan" }

export default async function PlanPage({ searchParams }: PageProps<"/dashboard/plan">) {
  const ctx = await requireBusiness()
  requirePermission(ctx, "settings:manage")
  const params = await searchParams
  const subscriptionResult = params.suscripcion
  // Viene de "Elegir Pro / Empresa" en precios: ese plan queda marcado para pagar.
  const planChoice = parsePlanChoice(params.plan)

  const plan = PLANS[ctx.business.plan]
  // Pro permanente (código de activación): sin fecha de vencimiento ni cobros mensuales.
  const lifetime = ctx.business.plan === "PRO" && !ctx.business.planExpiresAt && Boolean(ctx.business.licenseCodeId)
  const planEnds =
    ctx.business.plan !== "FREE" && ctx.business.planExpiresAt
      ? formatDate(ctx.business.planExpiresAt, ctx.timezone, { day: "numeric", month: "long", year: "numeric" })
      : null

  // En las apps de iPhone y Android no se contratan planes ni se canjean códigos (Apple y Google exigen su sistema de pago).
  const storeApp = isMobileStoreAppUserAgent((await headers()).get("user-agent"))
  // Suscripción con Mercado Pago (solo si el cobro está encendido).
  const showBilling = !storeApp && !lifetime && BILLING_ENABLED && mercadoPagoConfigured() && ctx.business.currency === "CLP"
  const sub = showBilling
    ? await db.subscription.findFirst({
        where: { businessId: ctx.businessId, status: { in: ["authorized", "paused", "pending"] } },
        orderBy: { createdAt: "desc" },
      })
    : null
  const subState: SubscriptionState = !sub
    ? { kind: "none" }
    : sub.status === "pending"
      ? { kind: "pending", plan: sub.plan === "BUSINESS" ? "BUSINESS" : "PRO", payerEmail: sub.payerEmail }
      : {
          kind: "active",
          planName: PLANS[sub.plan].name,
          status: sub.status,
          amountLabel: formatMoney(sub.amount, sub.currency),
          payerEmail: sub.payerEmail,
          nextLabel: sub.nextPaymentAt ? formatDate(sub.nextPaymentAt, ctx.timezone, { day: "numeric", month: "long" }) : null,
          giftPausedLabel: sub.giftPausedUntil ? formatDate(sub.giftPausedUntil, ctx.timezone, { day: "numeric", month: "long" }) : null,
        }
  const planOptions: PlanOption[] = PAID_PLANS.flatMap((p) => {
    const price = PLANS[p].monthlyPrice
    if (price === null) return []
    const final = discountedPrice(price, ctx.business.discountPercent)
    return [
      {
        plan: p,
        name: PLANS[p].name,
        priceLabel: formatMoney(final, "CLP"),
        amount: final,
        fullPriceLabel: final !== price ? formatMoney(price, "CLP") : undefined,
        summary: p === "PRO" ? "Tú + 20 trabajadores · hasta 3 sucursales" : "Trabajadores sin límite · hasta 10 sucursales",
      },
    ]
  })
  const extras = [
    ctx.business.extraProducts ? `+${ctx.business.extraProducts} productos` : null,
    ctx.business.extraMembers ? `+${ctx.business.extraMembers} trabajadores` : null,
  ].filter(Boolean)

  // Llegó para pagar (desde Precios, el Inicio o una función Pro): el formulario de pago va primero.
  const payFirst = Boolean(planChoice) && showBilling && subState.kind !== "active"
  const currentPlan = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="size-4 text-warning" />
          {lifetime ? "Estás en el Plan Pro · Permanente" : `Estás en el plan ${plan.name}`}
        </CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {plan.highlights.map((h) => (
            <li key={h}>· {h}</li>
          ))}
        </ul>
        {lifetime || planEnds || ctx.business.discountPercent || extras.length ? (
          <div className="flex flex-wrap gap-2">
            {lifetime ? <Badge variant="secondary">Plan Pro · Permanente: sin vencimiento ni cobros mensuales</Badge> : null}
            {planEnds ? <Badge variant="secondary">Vigente hasta el {planEnds}</Badge> : null}
            {ctx.business.discountPercent ? (
              <Badge variant="secondary">
                {ctx.business.discountPercent}% de descuento guardado ({ctx.business.discountCode})
              </Badge>
            ) : null}
            {extras.length ? <Badge variant="secondary">Cupos extra: {extras.join(" · ")}</Badge> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Tu plan" description={storeApp ? "Lo que incluye tu plan." : "Lo que incluye tu plan, y cómo contratar o cambiar a Pro o Empresa."} />

      {subscriptionResult === "ok" ? (
        <p className="rounded-lg bg-success/10 p-3 text-sm">¡Listo! Tu suscripción quedó activa.</p>
      ) : subscriptionResult === "pendiente" ? (
        <p className="rounded-lg bg-warning/10 p-3 text-sm">
          Mercado Pago todavía está procesando el pago. Apenas se confirme, tu plan se activará solo.
        </p>
      ) : null}

      {payFirst ? null : currentPlan}

      {showBilling ? (
        <Card id="contratar" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>{subState.kind === "active" ? "Tu suscripción" : "Contratar Pro o Empresa"}</CardTitle>
            <CardDescription>Se paga mes a mes y lo cancelas cuando quieras. Tus datos nunca se borran.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {planChoice && subState.kind !== "active" ? (
              <p className="rounded-lg border border-primary/30 bg-accent/50 p-3 text-sm">
                ¡Ya casi! Elegiste <strong>{PLANS[PLAN_OF_CHOICE[planChoice]].name}</strong>. Ingresa los datos de tu tarjeta para
                activarlo.
              </p>
            ) : null}
            <SubscriptionPanel
              state={subState}
              options={planOptions}
              initialPlan={planChoice ? PLAN_OF_CHOICE[planChoice] : ctx.business.plan === "BUSINESS" ? "BUSINESS" : "PRO"}
              defaultEmail={ctx.user.email}
              publicKey={process.env.MERCADOPAGO_PUBLIC_KEY || undefined}
              canManage={ctx.role === "OWNER"}
            />
          </CardContent>
        </Card>
      ) : null}

      {payFirst ? currentPlan : null}

      {storeApp ? (
        <p className="rounded-lg border p-3 text-sm text-muted-foreground">En esta app no se pueden contratar ni cambiar planes.</p>
      ) : (
        <Card id="canjear" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Canjear código</CardTitle>
            <CardDescription>Si compraste el Plan Pro permanente, ingresa aquí tu código de activación. También sirve para los códigos de descuento.</CardDescription>
          </CardHeader>
          <CardContent>
            <RedeemCoupon />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
