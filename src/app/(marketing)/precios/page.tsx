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

import { BILLING_ENABLED } from "@/lib/plans"

export const metadata: Metadata = {
  title: "Precios",
  description: BILLING_ENABLED
    ? "Empieza gratis con fiado, inventario, cierre de caja y reportes incluidos. Pro desde $6.990 al mes con proveedores, resultados e IVA, Excel y un equipo más grande. Cancelas cuando quieras."
    : "Empieza gratis. Durante el lanzamiento, las funciones Pro (inventario, fiado, clientes, reportes y equipo) también son gratis.",
  alternates: { canonical: "/precios" },
}

const PRICING_FAQ = FAQ_GROUPS.find((g) => g.title === "Cuenta y precios")?.items ?? []

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Precios"
        title="Empieza gratis. Crece cuando lo necesites."
        description={
          BILLING_ENABLED
            ? "El plan Gratis no vence y no pide tarjeta. Cuando necesites más, Pro o Empresa se pagan mes a mes con Mercado Pago y los cancelas cuando quieras."
            : "El plan Gratis no vence y no pide tarjeta. Durante el lanzamiento, además, puedes usar todo lo de Pro sin pagar."
        }
      />

      <Section muted className="border-t-0">
        <PricingCards />
      </Section>

      <Section>
        <SectionTitle eyebrow="Comparación" title="¿Qué incluye cada plan?" />
        <div className="mt-12 max-w-4xl">
          <PricingComparison />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {BILLING_ENABLED
              ? "Precios mensuales en pesos chilenos. Pro y Empresa se pagan con Mercado Pago (tarjeta de crédito o débito), se renuevan solos cada mes y los cancelas cuando quieras."
              : "Durante el lanzamiento todavía no se realizan cobros."}
          </p>
        </div>
      </Section>

      <Section muted>
        <div className="grid gap-10 md:grid-cols-[1fr_1.5fr] md:gap-16">
          <SectionTitle title="Sobre precios y tu cuenta" />
          <FaqList items={PRICING_FAQ} />
        </div>
      </Section>

      <CtaSection title="Empieza hoy, sin costo" text="Crea tu cuenta gratis en menos de un minuto." />
    </>
  )
}
