"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Logo } from "@/components/app/logo"
import { SignOutButton } from "@/components/app/user-menu"
import { SocialButtons, SocialLinks } from "@/components/landing/social-links"
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export const SITE_LINKS = [
  { href: "/funciones", label: "Funciones" },
  { href: "/como-funciona", label: "Cómo funciona" },
  { href: "/precios", label: "Precios" },
  { href: "/calculadoras", label: "Calculadoras" },
  { href: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
  { href: "/instalar", label: "Instalar" },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const { data: session } = useSession()
  const loggedIn = Boolean(session)

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
          {SITE_LINKS.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(`${l.href}/`))
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-2 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground xl:px-3",
                  active && "font-medium text-foreground",
                )}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <SocialLinks size="sm" className="mr-1 hidden xl:flex" />
          {loggedIn ? (
            <>
              <SignOutButton />
              <Button asChild>
                <Link href="/dashboard">Ir a mi negocio</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Iniciar sesión</Link>
              </Button>
              <Button asChild>
                <Link href="/registro">Crear cuenta</Link>
              </Button>
            </>
          )}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85%] max-w-xs">
            <SheetHeader>
              <SheetTitle className="text-left">Menú</SheetTitle>
            </SheetHeader>
            <nav className="grid gap-1 px-4" aria-label="Móvil">
              {SITE_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === l.href ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-base hover:bg-muted",
                    pathname === l.href && "bg-muted font-medium",
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="space-y-2 px-4 pt-2">
              <p className="px-1 text-sm font-medium text-muted-foreground">Síguenos</p>
              <SocialButtons />
            </div>
            <div className="mt-auto grid gap-2 p-4">
              {loggedIn ? (
                <>
                  <Button size="lg" className="h-11" asChild>
                    <Link href="/dashboard" onClick={() => setOpen(false)}>
                      Ir a mi negocio
                    </Link>
                  </Button>
                  <SignOutButton className="h-11 justify-center rounded-lg border" />
                </>
              ) : (
                <>
                  <Button variant="outline" size="lg" className="h-11" asChild>
                    <Link href="/login">Iniciar sesión</Link>
                  </Button>
                  <Button size="lg" className="h-11" asChild>
                    <Link href="/registro">Crear cuenta gratis</Link>
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
