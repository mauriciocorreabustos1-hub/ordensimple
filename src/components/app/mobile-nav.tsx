"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, LogOut, Menu, Plus, Receipt, ShoppingBag } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { Role } from "@/generated/prisma/enums"
import { NavLinks } from "@/components/app/app-sidebar"
import { useQuickActions } from "@/components/app/quick-actions"
import { useSignOut } from "@/components/app/user-menu"
import { isActive } from "@/lib/navigation"
import { cn } from "@/lib/utils"

/** Barra inferior para celular: lo más usado a un toque, el resto en "Más". */
export function MobileNav({ userName, userEmail, role }: { userName: string; userEmail: string; role: Role }) {
  const pathname = usePathname()
  const { open } = useQuickActions()
  const signOut = useSignOut()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [plusOpen, setPlusOpen] = React.useState(false)

  const tab = (href: string, label: string, Icon: typeof Home) => {
    const active = isActive(pathname, href)
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
          active && "text-primary",
        )}
      >
        <Icon className="size-5" />
        {label}
      </Link>
    )
  }

  return (
    <>
      <nav
        aria-label="Navegación"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden"
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
          {tab("/dashboard", "Inicio", Home)}
          {tab("/dashboard/ventas", "Ventas", ShoppingBag)}
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setPlusOpen(true)}
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
              aria-label="Registrar venta o gasto"
            >
              <Plus className="size-6" />
            </button>
          </div>
          {tab("/dashboard/gastos", "Gastos", Receipt)}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
          >
            <Menu className="size-5" />
            Más
          </button>
        </div>
      </nav>

      <Sheet open={plusOpen} onOpenChange={setPlusOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="text-center">
            <SheetTitle>¿Qué quieres registrar?</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 px-4">
            <button
              type="button"
              onClick={() => {
                setPlusOpen(false)
                open("sale")
              }}
              className="flex flex-col items-center gap-2 rounded-2xl bg-primary px-4 py-6 text-primary-foreground"
            >
              <ShoppingBag className="size-7" />
              <span className="font-semibold">Venta</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPlusOpen(false)
                open("expense")
              }}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-chart-2/40 bg-chart-2/10 px-4 py-6 text-foreground [&_svg]:text-chart-2"
            >
              <Receipt className="size-7" />
              <span className="font-semibold">Gasto</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="w-[85%] max-w-xs gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle className="truncate text-left">{userName}</SheetTitle>
            <p className="truncate text-left text-xs text-muted-foreground">{userEmail}</p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3">
            <NavLinks role={role} onNavigate={() => setMenuOpen(false)} />
          </div>
          <div className="border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
