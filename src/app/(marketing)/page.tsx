import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardPreview } from "@/components/landing/dashboard-preview"
import { PriceTag } from "@/components/landing/price-tag"
import { FAQ_GROUPS } from "@/components/landing/content"
import { Reveal } from "@/components/landing/reveal"
import { HeroNotebook } from "@/components/landing/hero-notebook"
import { LegacyHashRedirect } from "@/components/landing/legacy-hash-redirect"
import { StructuredData } from "@/components/landing/structured-data"
import { SocialSection } from "@/components/landing/social-section"
import { BusinessFinder } from "@/components/landing/business-finder"
import { TrustSection } from "@/components/landing/trust-section"
import { BusinessTypesLoop } from "@/components/landing/business-types-loop"
import { DayScrollStory } from "@/components/landing/day-scroll-story"
import { DesktopPreview } from "@/components/landing/desktop-preview"
import { MsStoreBadge } from "@/components/landing/ms-store-badge"
import { getUserCount } from "@/components/landing/user-count"
import { TurnTicket } from "@/components/landing/turn-ticket"
import { VideoDemo } from "@/components/landing/video-demo"
import {
  BeforeAfter,
  BenefitsSection,
  Container,
  CtaSection,
  FaqList,
  MoreLink,
  PricingCards,
  Section,
  SectionTitle,
  ReceiptSteps,
} from "@/components/landing/sections"
import { SignupLink } from "@/components/landing/signup-link"

export const metadata: Metadata = { alternates: { canonical: "/" } }

// Se regenera cada 10 minutos para que el contador de personas esté al día.
export const revalidate = 600

const TOP_FAQ = FAQ_GROUPS.flatMap((g) => g.items).slice(0, 5)

const DAY = [
  { time: "08:30", text: "Abres y ves de inmediato cómo va tu negocio." },
  { time: "13:00", text: "Vendes escaneando los productos con el celular." },
  { time: "21:00", text: "Cierras la caja en 1 minuto y sabes cuánto ganaste." },
]

export default async function LandingPage() {
  const users = await getUserCount()
  return (
    <>
      <StructuredData />
      <LegacyHashRedirect />

      <section className="overflow-hidden border-b bg-accent/30">
        <Container className="grid gap-x-14 gap-y-10 pt-12 pb-14 md:pt-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:pb-20">
          <h1 className="font-display text-[clamp(2.75rem,6.4vw,5.25rem)] leading-[0.98] font-semibold tracking-tight text-balance lg:col-span-2">
            <span className="block">Deja el cuaderno.</span> <span className="block">Ten todo tu negocio bajo control.</span>
          </h1>
          <div className="space-y-6">
            <p className="max-w-lg text-lg text-pretty text-muted-foreground">
              Administra tus ventas, inventario, clientes, pedidos y caja desde un solo lugar, en el celular o el computador. Menos trabajo administrativo, más tiempo para hacer crecer tu negocio.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-6 text-base" asChild>
                <SignupLink loggedInLabel="Ir a mi negocio">Comenzar gratis</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
                <Link href="/demo">Ver demostración</Link>
              </Button>
            </div>
            {/* Cuántos somos, como número de atención: se actualiza solo cada 10 minutos (ver revalidate arriba). */}
            {users ? <TurnTicket users={users} /> : null}
            <p className="text-sm text-muted-foreground">El plan básico es gratis para siempre y no te pedimos tarjeta.</p>
            <HeroNotebook />
          </div>
          <div className="relative pt-11 lg:-mr-24 xl:-mr-32">
            <PriceTag className="absolute top-0 left-3 z-10 -rotate-3 sm:left-6">
              <span className="font-display text-3xl font-semibold">$0</span>
              <span className="text-sm font-medium">para empezar</span>
            </PriceTag>
            <DashboardPreview />
          </div>
        </Container>
      </section>

      <BusinessTypesLoop />

      <DayScrollStory />

      {/* OrdenSimple para PC: todo el negocio en el computador, con impresión directa. */}
      <Section muted className="overflow-hidden">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <p className="text-sm font-medium text-primary">Nuevo en Microsoft Store</p>
            <SectionTitle
              align="left"
              title="Tu caja en el computador: vende, imprime y atiende al siguiente"
              description="Instala OrdenSimple gratis desde Microsoft Store. Registras la venta y el comprobante sale impreso en el mismo segundo, en tu impresora de siempre. Sin pasos de más y sin clientes esperando en la fila."
            />
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {[
                { title: "Imprime al instante", text: "Un clic y el comprobante, la cuenta o la comanda sale impresa, sin ventanas ni configuraciones." },
                { title: "Cocina sin gritos", text: "La comanda llega impresa a la cocina con letra grande, y suena un aviso en el celular." },
                { title: "Todo tu negocio", text: "Ventas, caja, inventario, fiado, reportes y comandas en una sola ventana." },
                { title: "Segura y siempre al día", text: "Verificada por Microsoft y con actualizaciones automáticas. Usa tu misma cuenta." },
              ].map((f) => (
                <div key={f.title} className="border-t border-foreground/15 pt-3">
                  <dt className="font-semibold">{f.title}</dt>
                  <dd className="mt-0.5 text-sm text-pretty text-muted-foreground">{f.text}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center gap-3">
              <MsStoreBadge />
              <Button size="lg" variant="outline" className="h-[52px]" asChild>
                <Link href="/descargar">Ver cómo funciona</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Gratis para Windows 10 y 11. Funciona con impresoras térmicas, USB y de red.</p>
          </div>
          <Reveal>
            <DesktopPreview />
          </Reveal>
        </div>
      </Section>

      <Section id="video" className="overflow-hidden">
        <div className="grid items-center gap-12 md:grid-cols-[1fr_auto] md:gap-16">
          <div className="space-y-6">
            <SectionTitle
              align="left"
              eyebrow="Míralo en 20 segundos"
              title="Un día en tu negocio con OrdenSimple"
              description="Sin cuadernos, sin planillas y sin calculadora. Así se ve tu día a día:"
            />
            <ul className="space-y-3">
              {DAY.map((d) => (
                <li key={d.time} className="flex items-start gap-3">
                  <span className="tabular mt-0.5 rounded-md bg-accent px-2 py-0.5 text-sm font-semibold text-accent-foreground">
                    {d.time}
                  </span>
                  <span className="text-pretty">{d.text}</span>
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 text-primary" />
              Funciona en el celular y en el computador.
            </p>
            <Button size="lg" className="h-12 px-6 text-base" asChild>
              <SignupLink loggedInLabel="Ir a mi negocio">Pruébalo gratis</SignupLink>
            </Button>
          </div>
          <VideoDemo
            src="/videos/un-dia-con-ordensimple.mp4"
            poster="/videos/un-dia-con-ordensimple.webp"
            label="Video: un día en un negocio usando OrdenSimple, desde abrir en la mañana hasta cerrar la caja en la noche."
          />
        </div>
      </Section>

      <Section muted>
        <SectionTitle
          animated
          align="left"
          title="Lo que cambia cuando dejas el cuaderno"
          description="Las mismas cosas que ya haces en tu negocio, pero sin que se te pierda nada."
        />
        <div className="mt-10">
          <BeforeAfter />
        </div>
        <MoreLink href="/funciones">Ver todas las funciones</MoreLink>
      </Section>

      <BenefitsSection />

      <BusinessFinder />

      <TrustSection users={users} />

      <Section>
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="space-y-4">
            <SectionTitle align="left" title="Empieza en 2 minutos" description="Sin instalar nada y sin tarjeta. Esto es todo lo que tienes que hacer." />
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button size="lg" className="h-11" asChild>
                <SignupLink loggedInLabel="Ir a mi negocio">Crear mi cuenta gratis</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-11" asChild>
                <Link href="/como-funciona">Conoce cómo funciona</Link>
              </Button>
            </div>
          </div>
          <ReceiptSteps />
        </div>
      </Section>

      <Section>
        <SectionTitle animated eyebrow="Precios" title="Empieza gratis. Crece cuando lo necesites." />
        <div className="mt-12">
          <PricingCards compact />
        </div>
        <MoreLink href="/precios">Comparar planes</MoreLink>
      </Section>

      <Section muted>
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
          <div className="space-y-4">
            <SectionTitle
              align="left"
              title="¿Tienes dudas?"
              description="Lo que más nos preguntan los dueños de negocio antes de empezar."
            />
            <Link href="/preguntas-frecuentes" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Ver todas las preguntas
            </Link>
          </div>
          <FaqList items={TOP_FAQ} />
        </div>
      </Section>

      <SocialSection />

      <CtaSection users={users} title="Hoy mismo puedes cerrar el cuaderno." />
    </>
  )
}
