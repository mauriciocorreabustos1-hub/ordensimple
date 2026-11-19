import Link from "next/link"
import { MadeBy } from "@/components/landing/made-by"
import { SocialButtons, WhatsAppButton } from "@/components/landing/social-links"
import { WhatsAppFloat } from "@/components/landing/whatsapp-float"
import { Logo } from "@/components/app/logo"
import { SmoothScroll } from "@/components/landing/smooth-scroll"
import { SiteHeader } from "@/components/landing/site-header"
import { CookieNotice } from "@/components/landing/cookie-notice"
import { FreightGoAd } from "@/components/landing/freightgo-ad"

const FOOTER = [
  {
    title: "Producto",
    links: [
      { href: "/funciones", label: "Funciones" },
      { href: "/como-funciona", label: "Cómo funciona" },
      { href: "/precios", label: "Precios" },
      { href: "/calculadoras", label: "Calculadoras gratis" },
      { href: "/restaurantes", label: "Para restaurantes" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { href: "/guias", label: "Guías para tu negocio" },
      { href: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
      { href: "/instalar", label: "Instalar en tu celular" },
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
      <SmoothScroll />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <footer className="bg-deep text-deep-foreground">
        <FreightGoAd />
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-x-4 gap-y-8 border-t border-deep-foreground/15 px-4 py-12 text-center sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr] md:text-left">
          <div className="col-span-3 flex flex-col items-center space-y-3 md:col-span-1 md:items-start">
            <Logo onDark />
            <p className="max-w-xs text-sm text-deep-foreground/75">
              Administra tu negocio sin complicarte. Hecho en Chile para emprendedores y pymes.
            </p>
            <div className="w-full max-w-xs space-y-2 pt-1 text-left text-foreground">
              <p className="text-center text-sm font-medium text-deep-foreground md:text-left">Síguenos</p>
              <SocialButtons />
              <p className="pt-2 text-center text-sm font-medium text-deep-foreground md:text-left">¿Dudas? Escríbenos</p>
              <WhatsAppButton />
            </div>
          </div>
          {FOOTER.map((col) => (
            <div key={col.title} className="space-y-2 text-sm">
              <p className="font-medium">{col.title}</p>
              <ul className="space-y-1.5 text-deep-foreground/75">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-deep-foreground hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-deep-foreground/15">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-5 pb-20 sm:px-6 md:flex-row md:justify-between md:pr-48 md:pb-5">
            <p className="text-center text-xs text-deep-foreground/70 md:text-left">
              © {new Date().getFullYear()} OrdenSimple, un producto de Orfex Group. Todos los derechos reservados.
            </p>
            <MadeBy onDark />
          </div>
        </div>
      </footer>
      <WhatsAppFloat />
      <CookieNotice />
    </div>
  )
}
