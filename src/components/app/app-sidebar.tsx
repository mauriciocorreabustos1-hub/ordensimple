"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/app/logo"
import { SignOutButton, UserMenu, type BusinessOption } from "@/components/app/user-menu"
import type { Role } from "@/generated/prisma/enums"
import { groupNav, isActive, navItemsFor, type NavProfile } from "@/lib/navigation"
import { BusinessLogo } from "@/components/app/business-logo"
import { SocialLinks, WhatsAppButton } from "@/components/landing/social-links"
import { cn } from "@/lib/utils"

/**
 * El menú, ordenado por grupos como los separadores de un archivador.
 * En la barra lateral (`tab`) la sección abierta sale como una pestaña del mismo color de la página, pegada a ella.
 */
export function NavLinks({
  role,
  profile = {},
  onNavigate,
  tab = false,
  showPro = true,
}: {
  role: Role
  profile?: NavProfile
  onNavigate?: () => void
  tab?: boolean
  /** Marca "Pro" en lo que no viene en el plan Gratis (no hace falta si el negocio ya tiene Pro). */
  showPro?: boolean
}) {
  const pathname = usePathname()
  return (
    <nav className="space-y-4" aria-label="Principal">
      {groupNav(navItemsFor(role, profile)).map(({ group, items }) => (
        <div key={group} role="group" aria-labelledby={`menu-grupo-${group}`}>
          <p id={`menu-grupo-${group}`} className="px-3 pb-1 text-xs font-medium text-muted-foreground/90">
            {group}
          </p>
          <div className="grid gap-px">
            {items.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  data-tour={`menu-${item.href.split("/").pop()}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active && !tab && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
                    // La pestaña: llega hasta el borde y se funde con la página; la raya verde marca dónde estás.
                    active &&
                      tab &&
                      "-mr-3 rounded-r-none bg-background font-semibold text-foreground shadow-[0_1px_2px_rgb(0_40_30/0.06)] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary hover:bg-background hover:text-foreground",
                  )}
                >
                  <item.icon className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.soon ? (
                    <span className="text-[10px] font-medium text-muted-foreground">Pronto</span>
                  ) : item.pro && showPro ? (
                    <span className="rounded border border-primary/25 px-1 text-[10px] leading-4 font-semibold text-primary/80">Pro</span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
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
  profile = {},
  showPro = true,
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
  /** Rubro del negocio: qué se muestra en el menú. */
  profile?: NavProfile
  showPro?: boolean
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[color-mix(in_oklch,var(--primary)_5%,var(--background))] lg:flex dark:bg-sidebar">
      <div className="space-y-3 px-4 pt-5 pb-4">
        <div className="px-1">
          <Logo href="/" />
        </div>
        {/* El negocio como la etiqueta del lomo del archivador. */}
        <p className="flex items-center gap-2.5 rounded-xl border bg-background px-2.5 py-2 shadow-xs" title={businessName}>
          <BusinessLogo businessId={businessId} name={businessName} logoUpdatedAt={logoUpdatedAt} className="size-8 rounded-lg text-[11px]" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">{businessName}</span>
            <span className="block text-xs text-muted-foreground">Tu negocio</span>
          </span>
        </p>
      </div>
      <div className="flex-1 overflow-y-auto pt-1 pb-4 pl-3 [scrollbar-width:thin]">
        <div className="pr-3">
          <NavLinks role={role} profile={profile} tab showPro={showPro} />
        </div>
      </div>
      <div className="space-y-1 border-t border-foreground/[0.07] px-3 pt-2 pb-3">
        <div className="flex items-center gap-1">
          <WhatsAppButton tone="sidebar" text="Hola, necesito ayuda con OrdenSimple" className="min-w-0 flex-1" />
          <SocialLinks size="sm" className="shrink-0 *:size-8 *:bg-transparent" />
        </div>
        <div className="flex items-center gap-1">
          <UserMenu
            name={userName}
            email={userEmail}
            image={userImage}
            businesses={businesses}
            showDetails
            isAdmin={isAdmin}
            hideSignOut
            className="min-w-0 flex-1"
          />
          <SignOutButton className="shrink-0 px-2.5 hover:bg-sidebar-accent" iconOnly />
        </div>
      </div>
    </aside>
  )
}
