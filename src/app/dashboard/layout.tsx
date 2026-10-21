import { AppSidebar } from "@/components/app/app-sidebar"
import { Logo } from "@/components/app/logo"
import { MobileNav } from "@/components/app/mobile-nav"
import { productCodes } from "@/lib/barcodes"
import { QuickActionsProvider } from "@/components/app/quick-actions"
import { activePromotions } from "@/server/sale-core"
import { EmailConfirmedToast, EmailVerifyBanner } from "@/components/app/email-verify-banner"
import { UserMenu } from "@/components/app/user-menu"
import { WelcomeTour } from "@/components/app/welcome-tour"
import { GuidedTour } from "@/components/app/guided-tour"
import { DiscountApprovals } from "@/components/app/discount-approvals"
import { OfflineSalesBar, OfflineSalesProvider } from "@/components/app/offline-sales"
import { db } from "@/lib/db"
import { businessProfile } from "@/lib/business-kind"
import { canUseFeature } from "@/lib/plans"
import { canApproveDiscounts } from "@/lib/roles"
import { isAdmin as checkAdmin } from "@/server/admin"
import { requireBusiness } from "@/server/session"

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const ctx = await requireBusiness()
  const isAdmin = await checkAdmin(ctx.user.email)

  const [products, categories, customers, memberships, suppliers, teamSize, promotions] = await Promise.all([
    db.product.findMany({
      where: { businessId: ctx.businessId, active: true },
      select: { id: true, name: true, price: true, stock: true, trackStock: true, categoryId: true, sku: true, barcodes: { select: { code: true } } },
      orderBy: { name: "asc" },
      take: 500,
    }),
    db.expenseCategory.findMany({
      where: { businessId: ctx.businessId },
      select: { id: true, name: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    db.customer.findMany({
      where: { businessId: ctx.businessId },
      select: { name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    db.businessMember.findMany({
      where: { userId: ctx.user.id, business: { onboardingCompleted: true } },
      select: { business: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Para elegir el proveedor al anotar un gasto: los que más compras primero.
    db.supplier.findMany({
      where: { businessId: ctx.businessId },
      select: { name: true },
      orderBy: [{ expenses: { _count: "desc" } }, { name: "asc" }],
      take: 200,
    }),
    // Con equipo, el dueño y los administradores reciben las solicitudes de descuento.
    canApproveDiscounts(ctx.role) ? db.businessMember.count({ where: { businessId: ctx.businessId } }) : Promise.resolve(0),
    // Promociones vigentes: se muestran al vender (el servidor las vuelve a calcular al guardar).
    activePromotions(ctx.businessId, ctx.business.plan),
  ])
  // Servicios y Agenda: por el rubro, o porque el negocio ya tiene servicios creados.
  const kind = businessProfile(ctx.business.type)
  const hasServices = kind.services || (await db.product.count({ where: { businessId: ctx.businessId, isService: true } })) > 0
  const profile = { ...kind, services: hasServices }
  const businesses = memberships.map((m) => ({ ...m.business, active: m.business.id === ctx.businessId }))

  return (
    <OfflineSalesProvider businessId={ctx.businessId}>
      <QuickActionsProvider
        currency={ctx.currency}
        timezone={ctx.timezone}
        defaultPayment={ctx.settings.defaultPayment}
        continuousScan={canUseFeature(ctx.business.plan, "fastScan")}
        fiado={canUseFeature(ctx.business.plan, "customers")}
        cashClose={canUseFeature(ctx.business.plan, "cashClose")}
        canApproveDiscounts={canApproveDiscounts(ctx.role)}
        productsOnly={!canApproveDiscounts(ctx.role) && ctx.settings.employeesProductsOnly}
        promotions={promotions}
        products={products.map(({ sku, barcodes, ...p }) => ({ ...p, codes: productCodes({ sku, barcodes }) }))}
        categories={categories}
        chargesVat={ctx.settings.chargesVat}
        customers={customers.map((c) => c.name)}
        suppliers={suppliers.map((s) => s.name)}
      >
        <AppSidebar
          businessId={ctx.businessId}
          logoUpdatedAt={ctx.business.logoUpdatedAt}
          businessName={ctx.business.name}
          role={ctx.role}
          userName={ctx.user.name}
          userEmail={ctx.user.email}
          userImage={ctx.user.image}
          businesses={businesses}
          isAdmin={isAdmin}
          profile={profile}
        />
        <div className="min-h-dvh bg-background lg:pl-64">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
            <Logo href="/" />
            <UserMenu name={ctx.user.name} email={ctx.user.email} image={ctx.user.image} businesses={businesses} isAdmin={isAdmin} />
          </header>
          <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
            {ctx.user.emailVerified ? null : <EmailVerifyBanner email={ctx.user.email} />}
            <EmailConfirmedToast />
            <OfflineSalesBar businessId={ctx.businessId} currency={ctx.currency} />
            {children}
          </main>
        </div>
        <MobileNav userName={ctx.user.name} userEmail={ctx.user.email} role={ctx.role} profile={profile} />
        {/* Tutorial de bienvenida: se abre solo la primera vez que la persona entra a la app. */}
        <WelcomeTour show={!(ctx.user as { welcomeTourAt?: Date | null }).welcomeTourAt} />
        {/* Guía práctica (anotar una venta, un gasto…): empieza desde la bienvenida. */}
        <GuidedTour />
        {teamSize > 1 ? <DiscountApprovals currency={ctx.currency} /> : null}
      </QuickActionsProvider>
    </OfflineSalesProvider>
  )
}
