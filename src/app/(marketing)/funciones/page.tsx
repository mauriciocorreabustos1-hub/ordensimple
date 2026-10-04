import type { Metadata } from "next"
import { Check } from "lucide-react"
import { COMING_SOON, FEATURE_GROUPS, TOOLS } from "@/components/landing/content"
import { CtaSection, FeatureGrid, PageHero, Section, SectionTitle } from "@/components/landing/sections"

export const metadata: Metadata = {
  title: "Funciones",
  description:
    "Ventas, gastos, productos, panel de inicio y calculadoras para tu negocio, explicados en palabras simples.",
  alternates: { canonical: "/funciones" },
}

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Funciones"
        title="Todo lo que tu negocio necesita, en un solo lugar"
        description="Registra lo que vendes y lo que gastas, conoce cuánto ganas con cada producto y toma decisiones con calculadoras simples."
      />

      <Section muted>
        <div className="grid gap-6 md:grid-cols-2">
          {FEATURE_GROUPS.map((g) => (
            <article key={g.id} id={g.id} className="scroll-mt-20 space-y-5 rounded-2xl border bg-card p-6 md:p-8">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <g.icon className="size-5" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">{g.title}</h2>
                  <p className="text-sm text-muted-foreground">{g.description}</p>
                </div>
              </div>
              <ul className="space-y-2.5">
                {g.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <SectionTitle
          eyebrow="Herramientas"
          title="Calculadoras que responden tus preguntas de todos los días"
          description="Usan tus números reales para prellenarse, pero nunca cambian tus datos."
        />
        <div className="mt-12">
          <FeatureGrid items={TOOLS} columns={4} />
        </div>
      </Section>

      <Section muted>
        <SectionTitle
          eyebrow="Próximamente"
          title="Lo que viene"
          description="Seguimos construyendo OrdenSimple. Esto es lo próximo que llegará."
        />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {COMING_SOON.map((f) => (
            <div key={f.title} className="space-y-2 rounded-2xl border border-dashed bg-card/60 p-5">
              <f.icon className="size-5 text-muted-foreground" />
              <p className="font-medium">{f.title}</p>
              <p className="text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaSection title="Pruébalo gratis hoy" text="Crea tu cuenta en menos de un minuto. Sin tarjeta de crédito." />
    </>
  )
}
