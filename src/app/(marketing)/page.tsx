import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardPreview } from "@/components/landing/dashboard-preview"
import { FAQ_GROUPS, HIGHLIGHTS } from "@/components/landing/content"
import { LegacyHashRedirect } from "@/components/landing/legacy-hash-redirect"
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

export default function LandingPage() {
  return (
    <>
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
