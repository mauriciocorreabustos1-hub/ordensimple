import Link from "next/link"
import { Logo } from "@/components/app/logo"
import { SiteHeader } from "@/components/landing/site-header"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              Administra tu negocio sin complicarte. Hecho en Chile para emprendedores y pymes.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium">Producto</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link href="/#funciones" className="hover:text-foreground">Funciones</Link></li>
              <li><Link href="/#precios" className="hover:text-foreground">Precios</Link></li>
              <li><Link href="/#preguntas" className="hover:text-foreground">Preguntas frecuentes</Link></li>
            </ul>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium">Cuenta</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link href="/login" className="hover:text-foreground">Iniciar sesión</Link></li>
              <li><Link href="/registro" className="hover:text-foreground">Crear cuenta</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
            © {new Date().getFullYear()} OrdenSimple. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
