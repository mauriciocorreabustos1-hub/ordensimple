import { AppSidebar } from "@/components/app/app-sidebar"
import { Logo } from "@/components/app/logo"
import { MobileNav } from "@/components/app/mobile-nav"
import { QuickActionsProvider } from "@/components/app/quick-actions"
import { UserMenu } from "@/components/app/user-menu"
import { db } from "@/lib/db"
import { isAdminEmail } from "@/server/admin"
import { requireBusiness } from "@/server/session"

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const ctx = await requireBusiness()
  const isAdmin = isAdminEmail(ctx.user.email)

  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { businessId: ctx.businessId, active: true },
      select: { id: true, name: true, price: true, stock: true, trackStock: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    db.expenseCategory.findMany({
      where: { businessId: ctx.businessId },
      select: { id: true, name: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
  ])

  return (
    <QuickActionsProvider
      currency={ctx.currency}
      timezone={ctx.timezone}
      defaultPayment={ctx.settings.defaultPayment}
      products={products}
      categories={categories}
    >
      <AppSidebar businessName={ctx.business.name} userName={ctx.user.name} userEmail={ctx.user.email} isAdmin={isAdmin} />
      <div className="min-h-dvh bg-background lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <Logo href="/dashboard" />
          <UserMenu name={ctx.user.name} email={ctx.user.email} isAdmin={isAdmin} />
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>
      <MobileNav userName={ctx.user.name} userEmail={ctx.user.email} />
    </QuickActionsProvider>
  )
}
