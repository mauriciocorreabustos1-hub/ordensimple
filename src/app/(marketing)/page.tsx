import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ClosingReceipt } from "@/components/landing/closing-receipt"
import { PriceTag } from "@/components/landing/price-tag"
import { FAQ_GROUPS } from "@/components/landing/content"
import { Reveal } from "@/components/landing/reveal"
import { LegacyHashRedirect } from "@/components/landing/legacy-hash-redirect"
import { StructuredData } from "@/components/landing/structured-data"
import { BusinessFinder } from "@/components/landing/business-finder"
import { Testimonials } from "@/components/landing/testimonials"
import { TrustSection } from "@/components/landing/trust-section"
import { BusinessTypesLoop } from "@/components/landing/business-types-loop"
import { DayScrollStory } from "@/components/landing/day-scroll-story"
import { DesktopPreview } from "@/components/landing/desktop-preview"
import { MsStoreBadge } from "@/components/landing/ms-store-badge"
import { getUserCount } from "@/components/landing/user-count"
import { TurnTicket } from "@/components/landing/turn-ticket"
import {
  BeforeAfter,
  Container,
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

const TOP_FAQ = FAQ_GROUPS.flatMap((g) => g.items).slice(0, 4)

export default async function LandingPage() {
  const users = await getUserCount()
  return (
    <>
      <StructuredData />
      <LegacyHashRedirect />

      <section className="ruled-page">
        <Container className="grid items-center gap-y-[var(--line)] pt-[calc(var(--line)*3)] pb-[calc(var(--line)*3)] lg:grid-cols-12 lg:gap-x-8">
          <div className="space-y-[var(--line)] pl-5 sm:pl-8 lg:col-span-8">
            <h1 className="font-display text-[2.75rem] leading-[48px] font-semibold tracking-tight sm:text-[3.6rem] sm:leading-[72px] lg:text-[clamp(4rem,5.9vw,5.1rem)] lg:leading-[84px]">
              <span className="block">Deja el cuaderno.</span> <span className="block">Ten todo tu negocio bajo control.</span>
            </h1>
            <p className="max-w-xl text-pretty text-foreground/80 leading-[var(--line)] lg:text-lg">
              Administra tus ventas, inventario, clientes, pedidos y caja desde un solo lugar, en el celular o el computador.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-6 text-base" asChild>
                <SignupLink loggedInLabel="Ir a mi negocio">Comenzar gratis</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-12 bg-card px-6 text-base" asChild>
                <Link href="/demo">Ver demostración</Link>
              </Button>
            </div>
            <p className="text-sm leading-[var(--line)] text-foreground/70">El plan básico es gratis para siempre y no te pedimos tarjeta.</p>
          </div>

          <div className="relative pt-10 lg:col-span-4 lg:col-start-9">
            <div className="print-in">
              <ClosingReceipt />
            </div>
            <PriceTag className="absolute top-0 left-1 z-10 sm:left-6 lg:left-0" hole="bg-card">
              <span className="font-display text-3xl font-semibold">$0</span>
              <span className="text-sm font-medium">para empezar</span>
            </PriceTag>
          </div>

          {/* Cuántos somos, como número de atención: se actualiza solo cada 10 minutos (ver revalidate arriba). */}
          {users ? (
            <div className="pl-5 sm:pl-8 lg:col-span-8">
              <TurnTicket users={users} />
            </div>
          ) : null}
        </Container>
      </section>

      <BusinessTypesLoop />

      <DayScrollStory />

      {/* OrdenSimple para PC: todo el negocio en el computador, con impresión directa. */}
      <Section className="overflow-hidden border-t-0 bg-accent/50">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="max-w-2xl space-y-3">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-[3.25rem] sm:leading-[1.04]">Tu caja en el computador: vende, imprime y atiende al siguiente</h2>
              <p className="text-lg text-pretty text-muted-foreground">
                Instala OrdenSimple gratis desde Microsoft Store. Registras la venta y el comprobante sale impreso en el mismo segundo, en tu impresora de siempre.
              </p>
            </div>
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

      <Section>
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

      <BusinessFinder />

      <Testimonials />

      <TrustSection users={users} />

      <Section muted>
        <SectionTitle animated eyebrow="Precios" title="Empieza gratis. Crece cuando lo necesites." />
        <div className="mt-12">
          <PricingCards compact />
        </div>
        <MoreLink href="/precios">Comparar planes</MoreLink>
      </Section>

      <Section>
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
          <div className="space-y-4">
            <SectionTitle
              align="left"
              title="¿Tienes dudas?"
              description="Lo que más nos preguntan los dueños de negocio antes de empezar."
            />
            <Link href="/preguntas-frecuentes" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline">
              Ver todas las preguntas
            </Link>
          </div>
          <FaqList items={TOP_FAQ} />
        </div>
      </Section>

      {/* El cierre: la invitación y lo poco que hay que hacer para empezar. */}
      <section className="bg-deep text-deep-foreground">
        <Container className="grid items-center gap-12 py-16 md:grid-cols-2 md:gap-16 md:py-24">
          <div className="space-y-4">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-[3.25rem] sm:leading-[1.04]">Hoy mismo puedes cerrar el cuaderno.</h2>
            <p className="text-lg text-pretty text-deep-foreground/75">Empieza en 2 minutos, sin instalar nada y sin tarjeta.</p>
            {users && users > 1 ? (
              <p className="text-deep-foreground/90">
                Únete a las <span className="tabular font-semibold">{users.toLocaleString("es-CL")}</span> personas que ya lo usan.
              </p>
            ) : null}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button size="lg" className="h-12 bg-deep-foreground px-6 text-base text-deep hover:bg-deep-foreground/90" asChild>
                <SignupLink loggedInLabel="Ir a mi negocio">Crear mi cuenta gratis</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-12 border-deep-foreground/40 bg-transparent px-6 text-base text-deep-foreground hover:bg-deep-foreground/10 hover:text-deep-foreground dark:bg-transparent" asChild>
                <Link href="/como-funciona">Conoce cómo funciona</Link>
              </Button>
            </div>
          </div>
          <ReceiptSteps />
        </Container>
      </section>
    </>
  )
}
