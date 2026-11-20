"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Logo } from "@/components/app/logo"
import { SignOutButton } from "@/components/app/user-menu"
import { BUSINESS_TYPES, businessTypeHref, openBusinessTypeHere } from "@/components/landing/business-types"
import { SocialButtons, SocialLinks, WhatsAppButton } from "@/components/landing/social-links"
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const HELP_LINKS = [
  { href: "/como-funciona", label: "Cómo funciona", hint: "Empieza en 2 minutos, paso a paso" },
  { href: "/demo", label: "Ver demostración", hint: "Recorre la app con datos de ejemplo" },
  { href: "/preguntas-frecuentes", label: "Preguntas frecuentes", hint: "Lo que más nos preguntan" },
  { href: "/guias", label: "Guías para tu negocio", hint: "Fiado, cierre de caja y ganancia" },
  { href: "/calculadoras", label: "Calculadoras gratis", hint: "Precio de venta, metas y equilibrio" },
  { href: "/instalar", label: "Instalar en el celular", hint: "Como una app, sin tienda" },
  { href: "/descargar", label: "App para el computador", hint: "Desde Microsoft Store" },
]

// Restaurantes tiene su propia página; los demás rubros abren su pestaña del archivador del inicio.
const SOLUTIONS = BUSINESS_TYPES.map((b) => ({ href: b.id === "comida" ? "/restaurantes" : businessTypeHref(b.id), label: b.label, hint: b.hint }))

/** Enlaces de primer nivel; los menús "Soluciones" y "Ayuda" se abren aparte. */
export const SITE_LINKS = [
  { href: "/funciones", label: "Funciones" },
  { href: "/precios", label: "Precios" },
]

const linkClass = "rounded-lg px-2.5 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground xl:px-3"

function NavMenu({ label, items, active }: { label: string; items: { href: string; label: string; hint: string }[]; active: boolean }) {
  const pathname = usePathname()
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={cn(linkClass, "inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:text-foreground", active && "font-medium text-foreground")}>
        {label}
        <ChevronDown className="size-3.5 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-72 p-1.5">
        {items.map((i) => (
          <DropdownMenuItem key={i.href} asChild className="cursor-pointer flex-col items-start gap-0 rounded-md px-3 py-2">
            <Link href={i.href} onClick={(e) => openBusinessTypeHere(e, i.href, pathname)}>
              <span className="text-sm font-medium">{i.label}</span>
              <span className="text-xs text-muted-foreground">{i.hint}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MobileGroup({ title, items, onPick }: { title: string; items: { href: string; label: string }[]; onPick: () => void }) {
  const pathname = usePathname()
  return (
    <div className="pt-3">
      <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{title}</p>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          onClick={(e) => {
            openBusinessTypeHere(e, i.href, pathname)
            onPick()
          }}
          className="block rounded-lg px-3 py-2.5 text-base hover:bg-muted">
          {i.label}
        </Link>
      ))}
    </div>
  )
}

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const { data: session } = useSession()
  const loggedIn = Boolean(session)
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))
  const close = () => setOpen(false)
  // Al bajar, el menú se hace más bajo y sólido para dejar más espacio al contenido; arriba del todo vuelve a ser como antes.
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="sticky top-safe z-40 border-b bg-background/80 backdrop-blur transition-[background-color,box-shadow] duration-300 supports-backdrop-filter:bg-background/70 data-scrolled:bg-background/95 data-scrolled:shadow-[0_10px_30px_-22px_rgb(0_0_0/0.45)]"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 transition-[height] duration-300 ease-out sm:px-6 in-data-scrolled:h-14 motion-reduce:transition-none">
        <Logo />
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Principal">
          <Link href="/funciones" aria-current={isActive("/funciones") ? "page" : undefined} className={cn(linkClass, isActive("/funciones") && "font-medium text-foreground")}>
            Funciones
          </Link>
          <NavMenu label="Soluciones" items={SOLUTIONS} active={isActive("/restaurantes")} />
          <Link href="/precios" aria-current={isActive("/precios") ? "page" : undefined} className={cn(linkClass, isActive("/precios") && "font-medium text-foreground")}>
            Precios
          </Link>
          <NavMenu label="Ayuda" items={HELP_LINKS} active={HELP_LINKS.some((l) => isActive(l.href))} />
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
                <Link href="/registro">Comenzar gratis</Link>
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
          <SheetContent side="right" className="w-[85%] max-w-xs overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-left">Menú</SheetTitle>
            </SheetHeader>
            <nav className="px-4" aria-label="Móvil">
              {SITE_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={close}
                  aria-current={pathname === l.href ? "page" : undefined}
                  className={cn("block rounded-lg px-3 py-2.5 text-base hover:bg-muted", pathname === l.href && "bg-muted font-medium")}
                >
                  {l.label}
                </Link>
              ))}
              <MobileGroup title="Soluciones" items={SOLUTIONS} onPick={close} />
              <MobileGroup title="Ayuda" items={HELP_LINKS} onPick={close} />
            </nav>
            <div className="space-y-2 px-4 pt-4">
              <p className="px-1 text-sm font-medium text-muted-foreground">Síguenos o escríbenos</p>
              <SocialButtons />
              <WhatsAppButton />
            </div>
            <div className="mt-auto grid gap-2 p-4">
              {loggedIn ? (
                <>
                  <Button size="lg" className="h-11" asChild>
                    <Link href="/dashboard" onClick={close}>
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
                    <Link href="/registro">Comenzar gratis</Link>
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
