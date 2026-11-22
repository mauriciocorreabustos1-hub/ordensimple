"use client"

import * as React from "react"
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
  // La barra lateral y el menú del celular pueden estar a la vez en la página: cada uno con sus propios id.
  const idBase = React.useId()
  const groups = groupNav(navItemsFor(role, profile))
  const activeHref = groups.flatMap((g) => g.items).find((i) => isActive(pathname, i.href))?.href ?? null
  // Al tocar una sección la pestaña se mueve al tiro, sin esperar a que cargue la página nueva.
  const [clicked, setClicked] = React.useState<{ href: string; from: string } | null>(null)
  const current = clicked && clicked.from === pathname ? clicked.href : activeHref
  const navRef = React.useRef<HTMLElement>(null)
  const tabRef = React.useRef<HTMLSpanElement>(null)

  // La pestaña es una sola y se desliza de una sección a otra, como una ficha que cambias de lugar.
  React.useLayoutEffect(() => {
    const nav = navRef.current
    const el = tabRef.current
    if (!tab || !nav || !el) return
    const link = current ? nav.querySelector<HTMLElement>(`[data-href="${current}"]`) : null
    if (!link) return void (el.style.opacity = "0")
    const first = el.dataset.ready !== "1"
    el.style.transition = first ? "none" : ""
    el.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`
    el.style.width = `${link.offsetWidth + 12}px`
    el.style.height = `${link.offsetHeight}px`
    el.style.opacity = "1"
    el.dataset.ready = "1"
  }, [current, tab])

  return (
    <nav ref={navRef} className="relative space-y-4" aria-label="Principal">
      {tab ? (
        <span
          ref={tabRef}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 rounded-l-lg bg-background opacity-0 shadow-[0_1px_2px_rgb(0_40_30/0.06)] transition-[transform,height] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary motion-reduce:transition-none"
        />
      ) : null}
      {groups.map(({ group, items }, i) => (
        <div key={group} role="group" aria-labelledby={`${idBase}-${i}`}>
          <p id={`${idBase}-${i}`} className="px-3 pb-1 text-xs font-medium text-muted-foreground/90">
            {group}
          </p>
          <div className="grid gap-px">
            {items.map((item) => {
              const active = tab ? item.href === current : isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-href={item.href}
                  onClick={() => {
                    if (tab) setClicked({ href: item.href, from: pathname })
                    onNavigate?.()
                  }}
                  data-tour={`menu-${item.href.split("/").pop()}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active && !tab && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
                    // La pestaña (el fondo que se desliza) llega hasta el borde y se funde con la página.
                    active && tab && "font-semibold text-foreground hover:bg-transparent hover:text-foreground",
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
