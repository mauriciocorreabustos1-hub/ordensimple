import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardPreview } from "@/components/landing/dashboard-preview"
import { FAQ_GROUPS, HIGHLIGHTS } from "@/components/landing/content"
import { LegacyHashRedirect } from "@/components/landing/legacy-hash-redirect"
import { StructuredData } from "@/components/landing/structured-data"
import { VideoDemo } from "@/components/landing/video-demo"
import {
  BenefitsSection,
  Container,
  CtaSection,
  FaqList,
  FeatureGrid,
  MoreLink,
  PricingCards,
  Section,
  SectionTitle,
  StepsGrid,
} from "@/components/landing/sections"

export const metadata: Metadata = { alternates: { canonical: "/" } }

const TOP_FAQ = FAQ_GROUPS.flatMap((g) => g.items).slice(0, 5)

const DAY = [
  { time: "08:30", text: "Abres y ves al tiro cómo va tu negocio." },
  { time: "13:00", text: "Vendes escaneando los productos con el celular." },
  { time: "21:00", text: "Cierras la caja en 1 minuto y sabes cuánto ganaste." },
]

export default function LandingPage() {
  return (
    <>
      <StructuredData />
      <LegacyHashRedirect />

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_70%)]" />
        <Container className="pt-14 pb-16 md:pt-20 md:pb-24">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <p className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Hecho para emprendedores y pymes de Chile
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
              Administra tu negocio sin complicarte.
            </h1>
            <p className="mx-auto max-w-xl text-lg text-pretty text-muted-foreground">
              Controla tus ventas, gastos, productos y ganancias desde un solo lugar.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-6 text-base" asChild>
                <Link href="/registro">
                  Comenzar gratis
                  <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
                <Link href="/como-funciona">Ver cómo funciona</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Gratis para siempre en el plan básico · Sin tarjeta de crédito</p>
          </div>
          <div className="mt-14 md:mt-16">
            <DashboardPreview />
          </div>
        </Container>
      </section>

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
                  <span className="tabular mt-0.5 rounded-md bg-accent px-2 py-0.5 text-sm font-semibold text-accent-foreground">{d.time}</span>
                  <span className="text-pretty">{d.text}</span>
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 text-primary" />
              Funciona en el celular y en el computador.
            </p>
            <Button size="lg" className="h-12 px-6 text-base" asChild>
              <Link href="/registro">
                Pruébalo gratis
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <VideoDemo
            src="/videos/un-dia-con-ordensimple.mp4"
            poster="/videos/un-dia-con-ordensimple.jpg"
            label="Video: un día en un negocio usando OrdenSimple, desde abrir en la mañana hasta cerrar la caja en la noche."
          />
        </div>
      </Section>

      <Section muted>
        <SectionTitle eyebrow="Funciones" title="Todo lo que necesitas, nada que te complique" />
        <div className="mt-12">
          <FeatureGrid items={HIGHLIGHTS} />
        </div>
        <MoreLink href="/funciones">Ver todas las funciones</MoreLink>
      </Section>

      <BenefitsSection />

      <Section muted>
        <SectionTitle eyebrow="Cómo funciona" title="Empieza en 2 minutos" />
        <div className="mt-12">
          <StepsGrid />
        </div>
        <MoreLink href="/como-funciona">Conoce cómo funciona</MoreLink>
      </Section>

      <Section>
        <SectionTitle eyebrow="Precios" title="Empieza gratis. Crece cuando lo necesites." />
        <div className="mt-12">
          <PricingCards />
        </div>
        <MoreLink href="/precios">Comparar planes</MoreLink>
      </Section>

      <Section muted>
        <div className="mx-auto max-w-3xl">
          <SectionTitle eyebrow="Preguntas frecuentes" title="¿Tienes dudas?" />
          <div className="mt-10">
            <FaqList items={TOP_FAQ} />
          </div>
          <MoreLink href="/preguntas-frecuentes">Ver todas las preguntas</MoreLink>
        </div>
      </Section>

      <CtaSection />
    </>
  )
}
