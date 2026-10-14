import { AppSidebar } from "@/components/app/app-sidebar"
import { Logo } from "@/components/app/logo"
import { MobileNav } from "@/components/app/mobile-nav"
import { productCodes } from "@/lib/barcodes"
import { QuickActionsProvider } from "@/components/app/quick-actions"
import { EmailConfirmedToast, EmailVerifyBanner } from "@/components/app/email-verify-banner"
import { UserMenu } from "@/components/app/user-menu"
import { WelcomeTour } from "@/components/app/welcome-tour"
import { OfflineSalesBar, OfflineSalesProvider } from "@/components/app/offline-sales"
import { db } from "@/lib/db"
import { canUseFeature } from "@/lib/plans"
import { isAdmin as checkAdmin } from "@/server/admin"
import { requireBusiness } from "@/server/session"

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const ctx = await requireBusiness()
  const isAdmin = await checkAdmin(ctx.user.email)

  const [products, categories, customers, memberships] = await Promise.all([
    db.product.findMany({
      where: { businessId: ctx.businessId, active: true },
      select: { id: true, name: true, price: true, stock: true, trackStock: true, sku: true, barcodes: { select: { code: true } } },
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
  ])
  const businesses = memberships.map((m) => ({ ...m.business, active: m.business.id === ctx.businessId }))

  return (
    <OfflineSalesProvider businessId={ctx.businessId}>
      <QuickActionsProvider
        currency={ctx.currency}
        timezone={ctx.timezone}
        defaultPayment={ctx.settings.defaultPayment}
        continuousScan={canUseFeature(ctx.business.plan, "fastScan")}
        products={products.map(({ sku, barcodes, ...p }) => ({ ...p, codes: productCodes({ sku, barcodes }) }))}
        categories={categories}
        chargesVat={ctx.settings.chargesVat}
        customers={customers.map((c) => c.name)}
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
        <MobileNav userName={ctx.user.name} userEmail={ctx.user.email} role={ctx.role} />
        {/* Tutorial de bienvenida: se abre solo la primera vez que la persona entra a la app. */}
        <WelcomeTour show={!(ctx.user as { welcomeTourAt?: Date | null }).welcomeTourAt} />
      </QuickActionsProvider>
    </OfflineSalesProvider>
  )
}
