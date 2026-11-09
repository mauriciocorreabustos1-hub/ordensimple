import { SocialSection } from "@/components/landing/social-section"
import type { Metadata } from "next"
import { Container, CtaSection, PageHero } from "@/components/landing/sections"
import { GuideList } from "@/components/landing/guide-page"
import { OtherCalculators } from "@/components/landing/calculator-page"

export const metadata: Metadata = {
  title: "Guías para tu negocio",
  description:
    "Guías prácticas para emprendedores y almacenes: cómo llevar el fiado, cómo hacer el cierre de caja y cómo calcular la ganancia de tu negocio.",
  alternates: { canonical: "/guias" },
}

export default function GuidesPage() {
  return (
    <>
      <PageHero
        eyebrow="Guías gratis"
        title="Aprende a ordenar tu negocio"
        description="Explicaciones cortas, con ejemplos en pesos chilenos y sin palabras difíciles."
      />
      <Container className="max-w-3xl space-y-12 pb-16">
        <GuideList />
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Calculadoras gratis</h2>
          <OtherCalculators />
        </section>
      </Container>
      <SocialSection />
      <CtaSection />
    </>
  )
}
