import type { Metadata } from "next"
import { ArrowRight, Moon, Sun, Sunset } from "lucide-react"
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
    icon: Sun,
    title: "En la mañana",
    text: "Abres OrdenSimple y ves cómo te fue ayer y si tu negocio va bien este mes.",
  },
  {
    icon: Sunset,
    title: "Durante el día",
    text: "Cada vez que vendes, tocas el botón verde y anotas el monto. Si pagas algo, lo registras como gasto.",
  },
  {
    icon: Moon,
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
        <SectionTitle eyebrow="Paso a paso" title="Cuatro pasos y listo" />
        <div className="mt-12">
          <StepsGrid detailed />
        </div>
      </Section>

      <Section>
        <SectionTitle eyebrow="Tu día con OrdenSimple" title="Menos de un minuto al día" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {DAY.map((d) => (
            <div key={d.title} className="space-y-3 rounded-2xl border bg-card p-6">
              <d.icon className="size-6 text-primary" />
              <p className="text-lg font-semibold">{d.title}</p>
              <p className="text-muted-foreground">{d.text}</p>
            </div>
          ))}
        </div>
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
        <div className="mx-auto mt-12 grid max-w-4xl gap-3">
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
