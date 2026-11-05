import type { Metadata } from "next"
import { DemoTour } from "@/components/landing/demo-tour"
import { CtaSection, PageHero, Section } from "@/components/landing/sections"

export const metadata: Metadata = {
  title: "Demostración",
  description: "Recorre OrdenSimple sin crear cuenta: ventas, inventario, fiado, cierre de caja y reportes de un almacén de ejemplo.",
  alternates: { canonical: "/demo" },
}

export default function DemoPage() {
  return (
    <>
      <PageHero title="Mira OrdenSimple por dentro" description="Estas son las pantallas reales de la app con un almacén de ejemplo. Recórrelas sin crear cuenta y sin dejar tus datos." />
      <Section className="border-t-0">
        <DemoTour />
        <p className="mt-8 text-sm text-muted-foreground">Los nombres, productos y montos son de ejemplo. Cuando crees tu cuenta, empiezas con tu negocio vacío y lo llenas a tu ritmo.</p>
      </Section>
      <CtaSection title="Comienza gratis y organiza tu negocio hoy." text="Crea tu cuenta en 2 minutos y registra tu primera venta." />
    </>
  )
}
