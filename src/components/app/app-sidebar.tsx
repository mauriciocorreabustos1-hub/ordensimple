"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut } from "lucide-react"
import { Logo } from "@/components/app/logo"
import { UserMenu, useSignOut } from "@/components/app/user-menu"
import { isActive, NAV_ITEMS } from "@/lib/navigation"
import { cn } from "@/lib/utils"

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="grid gap-0.5" aria-label="Principal">
      {NAV_ITEMS.map((item) => {
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
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppSidebar({
  businessName,
  userName,
  userEmail,
}: {
  businessName: string
  userName: string
  userEmail: string
}) {
  const signOut = useSignOut()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo href="/dashboard" />
      </div>
      <div className="px-5 pb-3">
        <p className="truncate rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground" title={businessName}>
          {businessName}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <NavLinks />
      </div>
      <div className="grid gap-1 border-t p-3">
        <UserMenu name={userName} email={userEmail} showDetails className="w-full" />
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
