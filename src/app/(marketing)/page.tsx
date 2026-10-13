import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardPreview } from "@/components/landing/dashboard-preview"
import { PriceTag } from "@/components/landing/price-tag"
import { FAQ_GROUPS } from "@/components/landing/content"
import { LegacyHashRedirect } from "@/components/landing/legacy-hash-redirect"
import { StructuredData } from "@/components/landing/structured-data"
import { VideoDemo } from "@/components/landing/video-demo"
import {
  BeforeAfter,
  BenefitsSection,
  Container,
  CtaSection,
  FaqList,
  MoreLink,
  PricingCards,
  Section,
  SectionTitle,
  ReceiptSteps,
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

      <section className="overflow-hidden border-b bg-accent/30">
        <Container className="grid items-center gap-12 pt-12 pb-14 md:pt-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:pb-20">
          <div className="space-y-6">
            <h1 className="font-display text-[2.6rem] leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl">
              Administra tu negocio sin complicarte.
            </h1>
            <p className="max-w-lg text-lg text-pretty text-muted-foreground">
              Para almacenes, botillerías, peluquerías y ferias: anota ventas, gastos, fiados y productos desde el celular, y sabe cada día
              cuánto estás ganando de verdad.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-6 text-base" asChild>
                <Link href="/registro">Crear mi cuenta gratis</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
                <Link href="/como-funciona">Ver cómo funciona</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">El plan básico es gratis para siempre y no te pedimos tarjeta.</p>
          </div>
          <div className="relative pt-11 lg:-mr-24 xl:-mr-32">
            <PriceTag className="absolute top-0 left-3 z-10 -rotate-3 sm:left-6">
              <span className="font-display text-3xl font-semibold">$0</span>
              <span className="text-sm font-medium">para empezar</span>
            </PriceTag>
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
                  <span className="tabular mt-0.5 rounded-md bg-accent px-2 py-0.5 text-sm font-semibold text-accent-foreground">
                    {d.time}
                  </span>
                  <span className="text-pretty">{d.text}</span>
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 text-primary" />
              Funciona en el celular y en el computador.
            </p>
            <Button size="lg" className="h-12 px-6 text-base" asChild>
              <Link href="/registro">Pruébalo gratis</Link>
            </Button>
          </div>
          <VideoDemo
            src="/videos/un-dia-con-ordensimple.mp4"
            poster="/videos/un-dia-con-ordensimple.webp"
            label="Video: un día en un negocio usando OrdenSimple, desde abrir en la mañana hasta cerrar la caja en la noche."
          />
        </div>
      </Section>

      <Section muted>
        <SectionTitle
          align="left"
          title="Lo que cambia cuando dejas el cuaderno"
          description="Las mismas cosas que ya haces en tu negocio, pero sin que se te pierda nada."
        />
        <div className="mt-10">
          <BeforeAfter />
        </div>
        <MoreLink href="/funciones">Ver todas las funciones</MoreLink>
      </Section>

      <BenefitsSection />

      <Section muted>
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="space-y-4">
            <SectionTitle align="left" title="Empieza en 2 minutos" description="Sin instalar nada y sin tarjeta. Esto es todo lo que tienes que hacer." />
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button size="lg" className="h-11" asChild>
                <Link href="/registro">Crear mi cuenta gratis</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-11" asChild>
                <Link href="/como-funciona">Conoce cómo funciona</Link>
              </Button>
            </div>
          </div>
          <ReceiptSteps />
        </div>
      </Section>

      <Section>
        <SectionTitle eyebrow="Precios" title="Empieza gratis. Crece cuando lo necesites." />
        <div className="mt-12">
          <PricingCards compact />
        </div>
        <MoreLink href="/precios">Comparar planes</MoreLink>
      </Section>

      <Section muted>
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
          <div className="space-y-4">
            <SectionTitle
              align="left"
              title="¿Tienes dudas?"
              description="Lo que más nos preguntan los dueños de negocio antes de empezar."
            />
            <Link href="/preguntas-frecuentes" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Ver todas las preguntas
            </Link>
          </div>
          <FaqList items={TOP_FAQ} />
        </div>
      </Section>

      <CtaSection />
    </>
  )
}
