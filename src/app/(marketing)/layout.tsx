import Link from "next/link"
import { Logo } from "@/components/app/logo"
import { SiteHeader } from "@/components/landing/site-header"

const FOOTER = [
  {
    title: "Producto",
    links: [
      { href: "/funciones", label: "Funciones" },
      { href: "/como-funciona", label: "Cómo funciona" },
      { href: "/precios", label: "Precios" },
      { href: "/calculadoras", label: "Calculadoras gratis" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { href: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
      { href: "/terminos", label: "Términos y condiciones" },
      { href: "/privacidad", label: "Política de privacidad" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { href: "/login", label: "Iniciar sesión" },
      { href: "/registro", label: "Crear cuenta" },
    ],
  },
]

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-x-4 gap-y-8 px-4 py-12 text-center sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr] md:text-left">
          <div className="col-span-3 flex flex-col items-center space-y-3 md:col-span-1 md:items-start">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              Administra tu negocio sin complicarte. Hecho en Chile para emprendedores y pymes.
            </p>
          </div>
          {FOOTER.map((col) => (
            <div key={col.title} className="space-y-2 text-sm">
              <p className="font-medium">{col.title}</p>
              <ul className="space-y-1.5 text-muted-foreground">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t">
          <p className="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-muted-foreground sm:px-6 md:text-left">
            © {new Date().getFullYear()} OrdenSimple. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
