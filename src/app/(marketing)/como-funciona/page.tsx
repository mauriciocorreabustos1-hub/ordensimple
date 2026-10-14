import type { Metadata } from "next"
import { ArrowRight } from "lucide-react"
import { DashboardPreview } from "@/components/landing/dashboard-preview"
import { TRANSLATIONS } from "@/components/landing/content"
import { CtaSection, PageHero, Section, SectionTitle, StepsGrid } from "@/components/landing/sections"

export const metadata: Metadata = {
  title: "Cómo funciona",
  description: "Empieza en 2 minutos: crea tu cuenta, cuéntanos de tu negocio y registra tus ventas y gastos.",
  alternates: { canonical: "/como-funciona" },
}

const DAY = [
  {
    time: "08:30",
    title: "En la mañana",
    text: "Abres OrdenSimple y ves cómo te fue ayer y si tu negocio va bien este mes.",
  },
  {
    time: "13:00",
    title: "Durante el día",
    text: "Cada vez que vendes, tocas el botón verde y anotas el monto. Si pagas algo, lo registras como gasto.",
  },
  {
    time: "21:00",
    title: "Al cerrar",
    text: "Miras cuánto vendiste, cuánto gastaste y cuánto te quedó hoy. Sin cuadrar planillas.",
  },
]

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="Cómo funciona"
        title="Empieza en 2 minutos, sin saber de contabilidad"
        description="OrdenSimple está pensado para usarse detrás del mostrador: rápido, desde el celular y con palabras que todos entienden."
      />

      <Section muted>
        <SectionTitle title="De cero a ordenado, con cronómetro" description="Esto es lo que toma empezar, minuto a minuto." />
        <div className="mt-12">
          <StepsGrid detailed />
        </div>
      </Section>

      <Section>
        <SectionTitle eyebrow="Tu día con OrdenSimple" title="Menos de un minuto al día" />
        <ul className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          {DAY.map((d) => (
            <li key={d.title} className="space-y-2 border-t border-foreground/80 pt-4">
              <span className="tabular inline-block rounded-md bg-accent px-2 py-0.5 text-sm font-semibold text-accent-foreground">{d.time}</span>
              <p className="text-lg font-semibold">{d.title}</p>
              <p className="text-pretty text-muted-foreground">{d.text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-14">
          <DashboardPreview />
        </div>
      </Section>

      <Section muted>
        <SectionTitle
          eyebrow="Así te hablamos"
          title="Nada de términos complicados"
          description="Cada número viene con una explicación en lenguaje de todos los días."
        />
        <div className="mt-12 grid max-w-4xl gap-3">
          {TRANSLATIONS.map((t) => (
            <div
              key={t.jargon}
              className="grid items-center gap-3 rounded-2xl border bg-card p-5 md:grid-cols-[1fr_auto_1.6fr] md:gap-5"
            >
              <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/40">{t.jargon}</p>
              <ArrowRight className="hidden size-4 text-primary md:block" aria-hidden />
              <p className="font-medium">{t.simple}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaSection />
    </>
  )
}
