"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/app/logo"
import { SignOutButton, UserMenu, type BusinessOption } from "@/components/app/user-menu"
import type { Role } from "@/generated/prisma/enums"
import { isActive, navItemsFor } from "@/lib/navigation"
import { BusinessLogo } from "@/components/app/business-logo"
import { cn } from "@/lib/utils"

export function NavLinks({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="grid gap-0.5" aria-label="Principal">
      {navItemsFor(role).map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <item.icon className={cn("size-4.5", active ? "text-primary" : "text-muted-foreground")} />
            <span className="flex-1">{item.label}</span>
            {item.soon ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Pronto
              </span>
            ) : item.pro ? (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Pro</span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppSidebar({
  businessId,
  logoUpdatedAt,
  businessName,
  role,
  userName,
  userEmail,
  userImage = null,
  businesses = [],
  isAdmin = false,
}: {
  businessId: string
  logoUpdatedAt: Date | null
  businessName: string
  role: Role
  userName: string
  userEmail: string
  userImage?: string | null
  businesses?: BusinessOption[]
  isAdmin?: boolean
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo href="/" />
      </div>
      <div className="px-5 pb-3">
        <p className="flex items-center gap-2 rounded-lg bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground" title={businessName}>
          <BusinessLogo businessId={businessId} name={businessName} logoUpdatedAt={logoUpdatedAt} className="size-7 rounded-md text-[10px]" />
          <span className="truncate">{businessName}</span>
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <NavLinks role={role} />
      </div>
      <div className="grid gap-1 border-t p-3">
        <UserMenu name={userName} email={userEmail} image={userImage} businesses={businesses} showDetails isAdmin={isAdmin} hideSignOut className="w-full" />
        <SignOutButton className="w-full justify-start hover:bg-sidebar-accent" />
      </div>
    </aside>
  )
}
