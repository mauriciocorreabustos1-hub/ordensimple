import type { Metadata } from "next"
import { Crown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/app/page-header"
import { BusinessForm } from "@/components/settings/business-form"
import { ExpenseCategories } from "@/components/settings/expense-categories"
import { PreferenceSwitch } from "@/components/settings/preference-switch"
import { VatDueDay } from "@/components/settings/vat-due-day"
import { vatInfo } from "@/lib/vat"
import { ThemePicker } from "@/components/settings/theme-picker"
import { MarketingSwitch } from "@/components/settings/marketing-switch"
import { AccountSection } from "@/components/settings/account-section"
import { RedeemCoupon } from "@/components/settings/redeem-coupon"
import { SubscriptionPanel, type PlanOption, type SubscriptionState } from "@/components/settings/subscription-panel"
import { formatMoney } from "@/lib/currency"
import { mercadoPagoConfigured } from "@/lib/mercadopago"
import { TeamSection } from "@/components/settings/team-section"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/dates"
import { getAppUrl } from "@/lib/app-url"
import { BILLING_ENABLED, discountedPrice, memberLimit, PAID_PLANS, parsePlanChoice, PLAN_OF_CHOICE, PLANS } from "@/lib/plans"
import { can, ROLE_LABEL } from "@/lib/roles"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Configuración" }

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/configuracion">) {
  const ctx = await requireBusiness()
  const params = await searchParams
  const subscriptionResult = params.suscripcion
  // Viene de "Elegir Pro / Empresa" en precios: ese plan queda marcado para pagar.
  const planChoice = parsePlanChoice(params.plan)
  const canManage = can(ctx.role, "settings:manage")
  const vat = vatInfo(ctx.business.country)
  const [categories, currentMembers, records, invitations, owned] = await Promise.all([
    db.expenseCategory.findMany({
      where: { businessId: ctx.businessId },
      select: { id: true, name: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    db.businessMember.findMany({
      where: { businessId: ctx.businessId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    Promise.all([
      db.sale.count({ where: { businessId: ctx.businessId } }),
      db.expense.count({ where: { businessId: ctx.businessId } }),
      db.product.count({ where: { businessId: ctx.businessId } }),
    ]),
    can(ctx.role, "members:manage")
      ? db.invitation.findMany({
          // El dueño ve las invitaciones pendientes de todas sus sucursales.
          where: { business: { members: { some: { userId: ctx.user.id, role: "OWNER" } } }, acceptedAt: null, expiresAt: { gt: new Date() } },
          include: { business: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    db.businessMember.findMany({
      where: { userId: ctx.user.id, role: "OWNER" },
      orderBy: { createdAt: "asc" },
      select: { business: { select: { id: true, name: true, _count: { select: { sales: true, members: true } } } } },
    }),
  ])
  // El dueño ve a todo su equipo, de todas sus sucursales, y a qué sucursales entra cada persona.
  const ownedIds = owned.map((o) => o.business.id)
  const access =
    ctx.role === "OWNER" && ownedIds.length > 1
      ? await db.businessMember.findMany({
          where: { businessId: { in: ownedIds } },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        })
      : []
  const members = access.length
    ? [
        ...currentMembers,
        ...access.filter((a, i) => !currentMembers.some((m) => m.userId === a.userId) && access.findIndex((x) => x.userId === a.userId) === i),
      ]
    : currentMembers
  const branchesOf = (userId: string) =>
    access.length ? access.filter((a) => a.userId === userId).map((a) => a.businessId) : [ctx.businessId]
  const plan = PLANS[ctx.business.plan]
  const planEnds =
    ctx.business.plan !== "FREE" && ctx.business.planExpiresAt
      ? formatDate(ctx.business.planExpiresAt, ctx.timezone, { day: "numeric", month: "long", year: "numeric" })
      : null
  const hasRecords = records.some((n) => n > 0)

  // Suscripción con Mercado Pago (solo si el cobro está encendido).
  const showBilling = BILLING_ENABLED && mercadoPagoConfigured() && ctx.business.currency === "CLP"
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
        fullPriceLabel: final !== price ? formatMoney(price, "CLP") : undefined,
        summary: p === "PRO" ? "Tú + 20 trabajadores · hasta 3 sucursales" : "Más de 50 trabajadores · hasta 10 sucursales",
      },
    ]
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" description="Ajusta OrdenSimple a tu manera." />

      {!canManage ? (
        <p className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
          Tu rol es {ROLE_LABEL[ctx.role]}. Solo el dueño o un administrador puede cambiar la configuración del negocio.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Modo Fácil</CardTitle>
          <CardDescription>Ideal si recién empiezas: el inicio muestra solo lo esencial.</CardDescription>
        </CardHeader>
        <CardContent>
          <PreferenceSwitch
            name="easyMode"
            label="Activar Modo Fácil"
            description="Verás solo ventas, gastos y ganancia de hoy, con botones grandes para registrar."
            checked={ctx.settings.easyMode}
            disabled={!canManage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos del negocio</CardTitle>
          <CardDescription>Nombre, país y moneda en la que llevas tus cuentas.</CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessForm
            initial={{
              name: ctx.business.name,
              type: ctx.business.type ?? "",
              country: ctx.business.country,
              currency: ctx.business.currency,
            }}
            currencyLocked={hasRecords}
            disabled={!canManage}
          />
        </CardContent>
      </Card>

      {vat ? (
        <Card>
          <CardHeader>
            <CardTitle>Impuestos ({vat.label})</CardTitle>
            <CardDescription>
              Para calcular cuánto {vat.label} pagar cada mes y ver tus resultados sin {vat.label}. Es una ayuda para
              prepararte: la cifra oficial es la que declaras{vat.form ? ` en el ${vat.form}` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <PreferenceSwitch
              name="chargesVat"
              label={`Mi negocio cobra ${vat.label}`}
              description={
                ctx.business.country === "CL"
                  ? "Viene activado. Desactívalo si tu negocio no tiene inicio de actividades en el SII o no emite boletas ni facturas."
                  : `Viene activado. Desactívalo si tus precios no incluyen ${vat.label} o no lo declaras cada mes.`
              }
              checked={ctx.settings.chargesVat}
              disabled={!canManage}
            />
            {ctx.settings.chargesVat ? (
              <VatDueDay value={ctx.settings.vatDueDay} chile={ctx.business.country === "CL"} disabled={!canManage} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Categorías de gastos</CardTitle>
          <CardDescription>Así agrupamos tus gastos para mostrarte en qué se va tu plata.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpenseCategories categories={categories} disabled={!canManage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avisos por correo</CardTitle>
          <CardDescription>
            Elige de qué quieres que te avisemos. Llegan a {ctx.user.email} y a los administradores del negocio.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <PreferenceSwitch
            name="lowStockAlerts"
            label="Stock bajo"
            description="Cuando a un producto le queden menos unidades que el mínimo o se agote."
            checked={ctx.settings.lowStockAlerts}
            disabled={!canManage}
          />
          <PreferenceSwitch
            name="noSalesReminder"
            label="Días sin ventas"
            description="Si pasan 3 días sin ventas registradas, para que no se te olvide anotarlas."
            checked={ctx.settings.noSalesReminder}
            disabled={!canManage}
          />
          <PreferenceSwitch
            name="weeklySummary"
            label="Resumen semanal"
            description="Cada lunes: cuánto vendiste, gastaste y te quedó la semana anterior."
            checked={ctx.settings.weeklySummary}
            disabled={!canManage}
          />
          <MarketingSwitch checked={Boolean((ctx.user as { marketingOptIn?: boolean }).marketingOptIn)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
          <CardDescription>Se guarda en este dispositivo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>Las personas que tienen acceso a tu negocio y a tus sucursales.</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamSection
            members={members.map((m) => ({
              id: m.id,
              name: m.user.name,
              email: m.user.email,
              role: m.role,
              isMe: m.userId === ctx.user.id,
              userId: m.userId,
              branchIds: branchesOf(m.userId),
            }))}
            invitations={invitations.map((inv) => ({
              id: inv.id,
              email: inv.email,
              role: inv.role,
              url: `${getAppUrl()}/invitacion/${inv.token}`,
              expiresLabel: formatDate(inv.expiresAt, ctx.timezone, { day: "numeric", month: "short" }),
              branchName: inv.business.name,
            }))}
            businessName={ctx.business.name}
            canManage={can(ctx.role, "members:manage")}
            isOwner={ctx.role === "OWNER"}
            limit={memberLimit(ctx.business.plan, ctx.business.extraMembers)}
            planName={plan.name}
            branches={ctx.role === "OWNER" ? owned.map((o) => ({ id: o.business.id, name: o.business.name })) : []}
            currentBranchId={ctx.businessId}
          />
        </CardContent>
      </Card>

      <Card id="plan" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="size-4 text-warning" />
            Tu plan: {plan.name}
          </CardTitle>
          <CardDescription>{plan.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {plan.highlights.map((h) => (
              <li key={h}>· {h}</li>
            ))}
          </ul>
          {planEnds || ctx.business.discountPercent ? (
            <div className="flex flex-wrap gap-2">
              {planEnds ? <Badge variant="secondary">Vigente hasta el {planEnds}</Badge> : null}
              {ctx.business.discountPercent ? (
                <Badge variant="secondary">
                  {ctx.business.discountPercent}% de descuento guardado ({ctx.business.discountCode})
                </Badge>
              ) : null}
            </div>
          ) : null}
          {subscriptionResult === "ok" ? (
            <p className="rounded-lg bg-success/10 p-3 text-sm">¡Listo! Tu suscripción quedó activa.</p>
          ) : subscriptionResult === "pendiente" ? (
            <p className="rounded-lg bg-warning/10 p-3 text-sm">
              Mercado Pago todavía está procesando el pago. Apenas se confirme, tu plan se activará solo.
            </p>
          ) : null}
          {showBilling && planChoice && subState.kind !== "active" ? (
            <p className="rounded-lg border border-primary/30 bg-accent/50 p-3 text-sm">
              ¡Ya casi! Elegiste <strong>{PLANS[PLAN_OF_CHOICE[planChoice]].name}</strong>. Escribe el correo de tu cuenta de Mercado
              Pago y toca el botón para pagar.
            </p>
          ) : null}
          {showBilling ? (
            <SubscriptionPanel
              state={subState}
              options={planOptions}
              initialPlan={planChoice ? PLAN_OF_CHOICE[planChoice] : ctx.business.plan === "BUSINESS" ? "BUSINESS" : "PRO"}
              defaultEmail={ctx.user.email}
              canManage={ctx.role === "OWNER"}
            />
          ) : null}
          {canManage ? (
            <>
              <Separator />
              <RedeemCoupon />
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tu cuenta</CardTitle>
          <CardDescription>Tus datos son tuyos: puedes llevártelos o eliminarlos cuando quieras.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountSection
            email={ctx.user.email}
            ownedBusinesses={owned.map((o) => ({
              name: o.business.name,
              sales: o.business._count.sales,
              others: o.business._count.members - 1,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
