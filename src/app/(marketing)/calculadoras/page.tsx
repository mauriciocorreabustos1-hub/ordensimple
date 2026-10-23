import type { Metadata } from "next"
import { Container, CtaSection, PageHero } from "@/components/landing/sections"
import { OtherCalculators } from "@/components/landing/calculator-page"

export const metadata: Metadata = {
  title: "Calculadoras gratis para emprendedores y pymes",
  description:
    "Calculadoras gratis para tu negocio: precio de venta y margen, punto de equilibrio y meta de ganancia. Explicadas en palabras simples.",
  alternates: { canonical: "/calculadoras" },
}

export default function CalculatorsPage() {
  return (
    <>
      <PageHero
        eyebrow="Gratis, sin crear cuenta"
        title="Calculadoras para tu negocio"
        description="Pon tus números y obtén la respuesta de inmediato, explicada en palabras simples."
      />
      <Container className="max-w-5xl pb-16">
        <OtherCalculators />
      </Container>
      <CtaSection
        title="¿Y si las calculadoras usaran tus números reales?"
        text="En OrdenSimple se llenan solas con tus ventas, gastos y productos. Gratis para empezar."
      />
    </>
  )
}
