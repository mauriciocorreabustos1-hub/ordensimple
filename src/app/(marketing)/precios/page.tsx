import type { Metadata } from "next"
import { FAQ_GROUPS } from "@/components/landing/content"
import {
  CtaSection,
  FaqList,
  PageHero,
  PricingCards,
  PricingComparison,
  Section,
  SectionTitle,
} from "@/components/landing/sections"

export const metadata: Metadata = {
  title: "Precios",
  description: "Empieza gratis con ventas, gastos, productos y calculadoras. Los planes Pro y Empresa llegan pronto.",
  alternates: { canonical: "/precios" },
}

const PRICING_FAQ = FAQ_GROUPS.find((g) => g.title === "Cuenta y precios")?.items ?? []

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Precios"
        title="Empieza gratis. Crece cuando lo necesites."
        description="El plan Gratis no vence y no pide tarjeta. Cuando tu negocio crezca, podrás pasarte a Pro o Empresa."
      />

      <Section muted className="border-t-0">
        <PricingCards />
      </Section>

      <Section>
        <SectionTitle eyebrow="Comparación" title="¿Qué incluye cada plan?" />
        <div className="mx-auto mt-12 max-w-4xl">
          <PricingComparison />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Los planes Pro y Empresa están en desarrollo. Todavía no se realizan cobros.
          </p>
        </div>
      </Section>

      <Section muted>
        <div className="mx-auto max-w-3xl">
          <SectionTitle eyebrow="Preguntas" title="Sobre precios y tu cuenta" />
          <div className="mt-10">
            <FaqList items={PRICING_FAQ} />
          </div>
        </div>
      </Section>

      <CtaSection title="Empieza hoy, sin costo" text="Crea tu cuenta gratis en menos de un minuto." />
    </>
  )
}
