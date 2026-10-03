import type { Metadata } from "next"
import { FAQ_GROUPS } from "@/components/landing/content"
import { CtaSection, FaqList, PageHero, Section } from "@/components/landing/sections"

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description: "Resolvemos tus dudas sobre OrdenSimple: precios, seguridad, uso diario y más.",
  alternates: { canonical: "/preguntas-frecuentes" },
}

// Datos estructurados para que Google pueda mostrar las preguntas en los resultados.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_GROUPS.flatMap((g) =>
    g.items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  ),
}

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <PageHero
        eyebrow="Preguntas frecuentes"
        title="¿Tienes dudas? Aquí las resolvemos"
        description="Si no encuentras lo que buscas, crea tu cuenta gratis y pruébalo: no necesitas tarjeta."
      />

      <Section muted className="border-t-0">
        <div className="mx-auto grid max-w-3xl gap-12">
          {FAQ_GROUPS.map((g) => (
            <div key={g.title} className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">{g.title}</h2>
              <FaqList items={g.items} />
            </div>
          ))}
        </div>
      </Section>

      <CtaSection />
    </>
  )
}
