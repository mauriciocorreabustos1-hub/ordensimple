import type { Metadata } from "next"
import { Crown, UserPlus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/app/page-header"
import { BusinessForm } from "@/components/settings/business-form"
import { ExpenseCategories } from "@/components/settings/expense-categories"
import { PreferenceSwitch } from "@/components/settings/preference-switch"
import { ThemePicker } from "@/components/settings/theme-picker"
import { MarketingSwitch } from "@/components/settings/marketing-switch"
import { RedeemCoupon } from "@/components/settings/redeem-coupon"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/dates"
import { PLANS } from "@/lib/plans"
import { can, ROLE_LABEL } from "@/lib/roles"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Configuración" }

export default async function SettingsPage() {
  const ctx = await requireBusiness()
  const canManage = can(ctx.role, "settings:manage")
  const [categories, members, records] = await Promise.all([
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
  ])
  const plan = PLANS[ctx.business.plan]
  const planEnds =
    ctx.business.plan !== "FREE" && ctx.business.planExpiresAt
      ? formatDate(ctx.business.planExpiresAt, ctx.timezone, { day: "numeric", month: "long", year: "numeric" })
      : null
  const hasRecords = records.some((n) => n > 0)

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
          <CardTitle>Notificaciones</CardTitle>
          <CardDescription>Elige de qué quieres que te avisemos.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <PreferenceSwitch
            name="lowStockAlerts"
            label="Stock bajo"
            description="Cuando a un producto le queden pocas unidades."
            checked={ctx.settings.lowStockAlerts}
            disabled={!canManage}
          />
          <PreferenceSwitch
            name="noSalesReminder"
            label="Días sin ventas"
            description="Si pasan 3 días sin que registres ventas."
            checked={ctx.settings.noSalesReminder}
            disabled={!canManage}
          />
          <PreferenceSwitch
            name="weeklySummary"
            label="Resumen semanal"
            description="Un resumen de cómo te fue cada semana (próximamente por correo)."
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
          <CardDescription>Las personas que tienen acceso a este negocio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                    {m.user.name
                      .split(" ")
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase())
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                </div>
                <Badge variant={m.role === "OWNER" ? "default" : "secondary"}>{ROLE_LABEL[m.role]}</Badge>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Invitar a tu equipo (administradores y empleados) estará disponible en el plan Empresa.
            </p>
            <Button variant="outline" disabled>
              <UserPlus />
              Invitar usuario
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
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
          {canManage ? (
            <>
              <Separator />
              <RedeemCoupon />
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
