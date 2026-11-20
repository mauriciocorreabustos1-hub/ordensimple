import Link from "next/link"
import { MadeBy } from "@/components/landing/made-by"
import { SocialButtons, WhatsAppButton } from "@/components/landing/social-links"
import { WhatsAppFloat } from "@/components/landing/whatsapp-float"
import { Logo } from "@/components/app/logo"
import { SmoothScroll } from "@/components/landing/smooth-scroll"
import { SiteHeader } from "@/components/landing/site-header"
import { CookieNotice } from "@/components/landing/cookie-notice"
import { FreightGoAd } from "@/components/landing/freightgo-ad"
import { MotionDirector } from "@/components/landing/motion-director"

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
      {/* Antes de pintar: marca si el equipo permite movimiento y, la primera vez en la portada, muestra la pantalla de entrada. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `if(!matchMedia("(prefers-reduced-motion: reduce)").matches){var d=document.documentElement;d.classList.add("motion");try{if(location.pathname==="/"&&!sessionStorage.getItem("ordensimple-intro")){sessionStorage.setItem("ordensimple-intro","1");d.classList.add("intro");setTimeout(function(){d.classList.remove("intro")},3000)}}catch(e){}}`,
        }}
      />
      <SmoothScroll />
      <MotionDirector />
      <div data-progress aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] origin-left scale-x-0 bg-primary motion-reduce:hidden" />
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
        {/* La palabra grande del pie: letra por letra al llegar; con el mouse, las letras se levantan. */}
        <div className="mx-auto max-w-6xl overflow-hidden px-4 sm:px-6" aria-hidden>
          <p data-footer-word className="flex justify-between pb-[0.12em] font-display text-[length:min(15vw,11.25rem)] leading-none font-semibold tracking-tight text-deep-foreground/90 select-none">
            {"OrdenSimple".split("").map((ch, i) => (
              <span key={i} className="inline-block">
                {ch}
              </span>
            ))}
          </p>
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
