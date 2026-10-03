"use client"

import * as React from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Logo } from "@/components/app/logo"

const LINKS = [
  { href: "/#inicio", label: "Inicio" },
  { href: "/#funciones", label: "Funciones" },
  { href: "/#precios", label: "Precios" },
  { href: "/#preguntas", label: "Preguntas frecuentes" },
]

export function SiteHeader() {
  const [open, setOpen] = React.useState(false)
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" asChild>
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button asChild>
            <Link href="/registro">Crear cuenta</Link>
          </Button>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85%] max-w-xs">
            <SheetHeader>
              <SheetTitle className="text-left">Menú</SheetTitle>
            </SheetHeader>
            <nav className="grid gap-1 px-4" aria-label="Móvil">
              {LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-base hover:bg-muted">
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="mt-auto grid gap-2 p-4">
              <Button variant="outline" size="lg" className="h-11" asChild>
                <Link href="/login">Iniciar sesión</Link>
              </Button>
              <Button size="lg" className="h-11" asChild>
                <Link href="/registro">Crear cuenta gratis</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
