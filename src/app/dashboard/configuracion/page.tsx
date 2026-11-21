import type { Metadata } from "next"
import { MadeBy } from "@/components/landing/made-by"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Crown } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/app/page-header"
import { SettingsNav } from "@/components/settings/settings-nav"
import { SETTINGS_SECTIONS, type SettingsSection } from "@/lib/settings-sections"
import { BusinessForm } from "@/components/settings/business-form"
import { LogoUploader } from "@/components/settings/logo-uploader"
import { PhotoUploader } from "@/components/settings/photo-uploader"
import { TwoFactorSettings } from "@/components/settings/two-factor-settings"
import { GoogleLink } from "@/components/settings/google-link"
import { GOOGLE_ENABLED } from "@/lib/auth"
import { headers } from "next/headers"
import { isAdmin } from "@/server/admin"
import { ExpenseCategories } from "@/components/settings/expense-categories"
import { StorePreview } from "@/components/store/store-preview"
import { FiadoDays } from "@/components/settings/fiado-days"
import { CardFeesSettings } from "@/components/settings/card-fees-settings"
import { PushSettings } from "@/components/settings/push-settings"
import { StoreSettings } from "@/components/settings/store-settings"
import { BookingSettings } from "@/components/settings/booking-settings"
import { readBookingHours } from "@/lib/booking"
import { businessProfile } from "@/lib/business-kind"
import { ProUpsell } from "@/components/app/pro-gate"
import { PreferenceSwitch } from "@/components/settings/preference-switch"
import { VatDueDay } from "@/components/settings/vat-due-day"
import { TablesSettings } from "@/components/settings/tables-settings"
import { isFoodBusiness } from "@/lib/business-kind"
import { PpmRate } from "@/components/settings/ppm-rate"
import { vatInfo } from "@/lib/vat"
import { ThemePicker } from "@/components/settings/theme-picker"
import { MarketingSwitch } from "@/components/settings/marketing-switch"
import { AccountSection } from "@/components/settings/account-section"
import { TeamSection } from "@/components/settings/team-section"
import { PrinterSettings } from "@/components/settings/printer-settings"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/dates"
import { getAppUrl } from "@/lib/app-url"
import { canUseFeature, memberLimit, PLANS } from "@/lib/plans"
import { can, ROLE_LABEL } from "@/lib/roles"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Configuración" }

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/configuracion">) {
  const ctx = await requireBusiness()
  // Enlaces antiguos al plan (?plan= o ?suscripcion=) ahora van a "Tu plan".
  const params = await searchParams
  if (params.plan || params.suscripcion) {
    redirect(`/dashboard/plan?${new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string"))}`)
  }
  const canManage = can(ctx.role, "settings:manage")
  const section: SettingsSection = params["dos-pasos"] ? "cuenta" : (SETTINGS_SECTIONS.find((x) => x.id === params.seccion)?.id ?? "negocio")
  const current = SETTINGS_SECTIONS.find((x) => x.id === section)!
  const profile = businessProfile(ctx.business.type)
  const hasServices = profile.services || (await db.product.count({ where: { businessId: ctx.businessId, isService: true } })) > 0
  const twoFactorUser = ctx.user as { twoFactorEnabled?: boolean | null; twoFactorMethod?: string | null }
  const twoFactor = { enabled: Boolean(twoFactorUser.twoFactorEnabled), method: twoFactorUser.twoFactorMethod ?? null }
  const userIsAdmin = await isAdmin(ctx.user.email)
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
  // Tu cuenta: con qué entra la persona (contraseña y/o Google), para "Vincular con Google".
  const signInMethods =
    section === "cuenta" && GOOGLE_ENABLED
      ? await db.account.findMany({ where: { userId: ctx.user.id }, select: { id: true, providerId: true } })
      : []
  const googleAccount = signInMethods.find((a) => a.providerId === "google")
  const inDesktopApp = ((await headers()).get("user-agent") ?? "").includes("OrdenSimpleDesktop")
  const members = access.length
    ? [
        ...currentMembers,
        ...access.filter((a, i) => !currentMembers.some((m) => m.userId === a.userId) && access.findIndex((x) => x.userId === a.userId) === i),
      ]
    : currentMembers
  const branchesOf = (userId: string) =>
    access.length ? access.filter((a) => a.userId === userId).map((a) => a.businessId) : [ctx.businessId]
  const hasRecords = records.some((n) => n > 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" description="Ajusta OrdenSimple a tu manera." />

      {!canManage ? (
        <p className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
          Tu rol es {ROLE_LABEL[ctx.role]}. Solo el dueño o un administrador puede cambiar la configuración del negocio.
        </p>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SettingsNav active={section} />
        <div className="min-w-0 space-y-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <current.icon className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{current.label}</h2>
              <p className="text-sm text-muted-foreground">{current.hint}</p>
            </div>
          </div>
          {section === "negocio" ? (
            <>
            <Card>
              <CardHeader>
                <CardTitle>Datos del negocio</CardTitle>
                <CardDescription>Logo, nombre, país y moneda en la que llevas tus cuentas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <LogoUploader
                  businessId={ctx.businessId}
                  name={ctx.business.name}
                  logoUpdatedAt={ctx.business.logoUpdatedAt?.toISOString() ?? null}
                  disabled={!canManage}
                />
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

            {isFoodBusiness(ctx.business.type) ? (
              <Card id="mesas" className="scroll-mt-20">
                <CardHeader>
                  <CardTitle>Mesas</CardTitle>
                  <CardDescription>Las mesas y lugares de tu local. Aparecen al abrir una comanda, y ves de inmediato cuáles están ocupadas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <TablesSettings count={ctx.settings.tableCount} extras={ctx.settings.tableExtras} disabled={!canManage} />
                  <p className="text-xs text-muted-foreground">
                    ¿Quieres que te pidan desde la mesa?{" "}
                    <Link href="/dashboard/comandas/carta-qr" className="font-medium text-primary hover:underline">
                      Imprime un código QR para cada mesa
                    </Link>
                    .
                  </p>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Apariencia</CardTitle>
                <CardDescription>Se guarda en este dispositivo.</CardDescription>
              </CardHeader>
              <CardContent>
                <ThemePicker />
              </CardContent>
            </Card>
            </>
          ) : null}
          {section === "tienda" ? (
            <>
            <Card id="tienda" className="scroll-mt-20">
              <CardHeader>
                <CardTitle>Tienda online</CardTitle>
                <CardDescription>
                  Una página con tus productos y precios para compartir por WhatsApp o en tus redes. Tus clientes eligen y te mandan el pedido
                  por WhatsApp; te queda en “Pedidos web” para registrarlo con un toque.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {canUseFeature(ctx.business.plan, "store") ? (
                  <StoreSettings
                    businessName={ctx.business.name}
                    enabled={ctx.business.storeEnabled}
                    slug={ctx.business.storeSlug}
                    whatsapp={ctx.business.storeWhatsapp}
                    message={ctx.business.storeMessage}
                    appUrl={getAppUrl()}
                    disabled={!canManage}
                  />
                ) : (
                  <ProUpsell
                    title="Publicar tu tienda es parte del plan Pro"
                    text="Ármala y mírala gratis. Con Pro la publicas con tu propia dirección para compartirla por WhatsApp y redes, y recibes pedidos por WhatsApp o pagados con tarjeta."
                  />
                )}
              </CardContent>
            </Card>
            <Card id="vista-previa" className="scroll-mt-20">
              <CardHeader>
                <CardTitle>Vista previa</CardTitle>
                <CardDescription>
                  Así ven tu tienda tus clientes en el celular, con tus productos, fotos, precios y descripciones. Los cambios que hagas en
                  Productos se ven aquí de inmediato.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StorePreview business={{ ...ctx.business, timezone: ctx.timezone }} />
              </CardContent>
            </Card>
            {hasServices ? (
              <Card id="reservas" className="scroll-mt-20">
                <CardHeader>
                  <CardTitle>Reserva tu hora</CardTitle>
                  <CardDescription>
                    En tu página, tus clientes eligen el servicio, con quién y una hora libre según tu horario. La cita aparece sola en tu
                    Agenda y te llega un aviso al celular.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {canUseFeature(ctx.business.plan, "agenda") && canUseFeature(ctx.business.plan, "store") ? (
                    <BookingSettings
                      enabled={ctx.settings.bookingEnabled}
                      hours={readBookingHours(ctx.settings.bookingHours)}
                      slotMin={ctx.settings.bookingSlotMin}
                      noticeMin={ctx.settings.bookingMinNoticeMin}
                      maxDays={ctx.settings.bookingMaxDays}
                      storeReady={Boolean(ctx.business.storeEnabled && ctx.business.storeSlug && ctx.business.storeWhatsapp)}
                      servicesWithDuration={await db.product.count({ where: { businessId: ctx.businessId, active: true, isService: true, durationMin: { not: null }, price: { gt: 0 } } })}
                      disabled={!canManage}
                    />
                  ) : (
                    <ProUpsell title="Las reservas online son parte del plan Pro" text="Tus clientes reservan solos y la cita aparece en tu Agenda." />
                  )}
                </CardContent>
              </Card>
            ) : null}
            </>
          ) : null}
          {section === "impuestos" ? (
            <>
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
                  {ctx.settings.chargesVat && ctx.business.country === "CL" ? <PpmRate value={ctx.settings.ppmRate} disabled={!canManage} /> : null}
                </CardContent>
              </Card>
            ) : null}

            <Card id="maquina" className="scroll-mt-20">
              <CardHeader>
                <CardTitle>Máquina de tarjetas</CardTitle>
                <CardDescription>
                  Lo que te descuenta tu máquina (Transbank, Getnet, SumUp, Mercado Pago u otra) por cada pago con débito o crédito. Lo
                  restamos de tu ganancia en Inicio y Reportes, y en el cierre de caja ves cuánto te depositan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CardFeesSettings debit={ctx.settings.cardFeeDebit} credit={ctx.settings.cardFeeCredit} currency={ctx.currency} disabled={!canManage} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Categorías de gastos</CardTitle>
                <CardDescription>Así agrupamos tus gastos para mostrarte en qué se va tu dinero.</CardDescription>
              </CardHeader>
              <CardContent>
                <ExpenseCategories categories={categories} disabled={!canManage} />
              </CardContent>
            </Card>
            </>
          ) : null}
          {section === "impresoras" ? <PrinterSettings food={isFoodBusiness(ctx.business.type)} /> : null}
          {section === "avisos" ? (
            <>
            <Card id="avisos" className="scroll-mt-20">
              <CardHeader>
                <CardTitle>Avisos por correo</CardTitle>
                <CardDescription>
                  Elige de qué quieres que te avisemos. Llegan a {ctx.user.email} y a los administradores del negocio.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? <PushSettings publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} /> : null}
                <PreferenceSwitch
                  name="lowStockAlerts"
                  label="Stock bajo"
                  description="Cuando a un producto le queden menos unidades que el mínimo o se agote."
                  checked={ctx.settings.lowStockAlerts}
                  disabled={!canManage}
                />
                <PreferenceSwitch
                  name="expiryAlerts"
                  label="Productos por vencer"
                  description="Productos y materiales de recetas que vencen en los próximos 7 días y todavía tienen stock, con cuánto dinero está en riesgo."
                  checked={ctx.settings.expiryAlerts}
                  disabled={!canManage}
                />
                {canUseFeature(ctx.business.plan, "customers") ? (
                  <>
                    <PreferenceSwitch
                      name="fiadoReminders"
                      label="Fiado por cobrar"
                      description="Una vez por semana, los clientes que se pasaron del plazo de pago, con cuánto deben."
                      checked={ctx.settings.fiadoReminders}
                      disabled={!canManage}
                    />
                    <FiadoDays value={ctx.settings.fiadoDays} disabled={!canManage} />
                  </>
                ) : null}
                <PreferenceSwitch
                  name="noSalesReminder"
                  label="Días sin ventas"
                  description="Si pasan 3 días sin ventas registradas, para que no se te olvide anotarlas."
                  checked={ctx.settings.noSalesReminder}
                  disabled={!canManage}
                />
                <div className="space-y-0.5 py-3">
                  <p className="text-sm font-medium">Resumen de los lunes</p>
                  <p className="text-xs text-muted-foreground">
                    Cada lunes te llega cuánto vendiste, gastaste y te quedó la semana anterior. Llega siempre, para que nunca pierdas de vista tu
                    negocio.
                  </p>
                </div>
                <MarketingSwitch checked={Boolean((ctx.user as { marketingOptIn?: boolean }).marketingOptIn)} />
              </CardContent>
            </Card>
            </>
          ) : null}
          {section === "equipo" ? (
            <>
            <Card id="equipo">
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
                  planName={PLANS[ctx.business.plan].name}
                  branches={ctx.role === "OWNER" ? owned.map((o) => ({ id: o.business.id, name: o.business.name })) : []}
                  currentBranchId={ctx.businessId}
                />
                {can(ctx.role, "settings:manage") ? (
                  <div className="mt-4 border-t pt-2">
                    <PreferenceSwitch
                      name="employeesProductsOnly"
                      label="Los empleados solo venden productos guardados"
                      description="Sin venta rápida ni productos escritos a mano: así cobran siempre el precio de lista y todo descuento pasa por tu aprobación. Desactívalo si tu equipo vende servicios sin precio fijo."
                      checked={ctx.settings.employeesProductsOnly}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
            </>
          ) : null}
          {section === "cuenta" ? (
            <>
            {canManage ? (
              <Link
                href="/dashboard/plan"
                className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Crown className="size-4 text-warning" />
                  Tu plan: {PLANS[ctx.business.plan].name}
                </span>
                <span className="text-sm text-primary">Ver o cambiar plan</span>
              </Link>
            ) : null}

            <Card id="seguridad" className="scroll-mt-20">
              <CardHeader>
                <CardTitle>Verificación en dos pasos</CardTitle>
                <CardDescription>Protege tu cuenta con un código además de la contraseña.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {params["dos-pasos"] === "admin" && !twoFactor.enabled ? (
                  <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                    Para entrar al panel de administración, activa primero la verificación en dos pasos.
                  </p>
                ) : null}
                <TwoFactorSettings enabled={twoFactor.enabled} method={twoFactor.method} isAdmin={userIsAdmin} />
              </CardContent>
            </Card>

            <Card id="cuenta">
              <CardHeader>
                <CardTitle>Tu cuenta</CardTitle>
                <CardDescription>Tu foto y tus datos. Son tuyos: puedes llevártelos o eliminarlos cuando quieras.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <PhotoUploader name={ctx.user.name} image={ctx.user.image ?? null} />
                {GOOGLE_ENABLED ? (
                  <GoogleLink
                    googleAccountId={googleAccount?.id ?? null}
                    hasPassword={signInMethods.some((a) => a.providerId === "credential")}
                    emailVerified={ctx.user.emailVerified}
                    twoFactor={twoFactor.enabled}
                    inDesktopApp={inDesktopApp}
                    status={
                      params.google === "vinculado"
                        ? { ok: true }
                        : typeof params.error === "string"
                          ? { error: params.error }
                          : undefined
                    }
                  />
                ) : null}
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
            <div className="flex justify-center pt-2">
              <MadeBy />
            </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
