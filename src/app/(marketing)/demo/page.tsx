import type { Metadata } from "next"
import { DemoTour } from "@/components/landing/demo-tour"
import { VideoDemo } from "@/components/landing/video-demo"
import { CtaSection, PageHero, Section, SectionTitle } from "@/components/landing/sections"

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
      <Section muted className="overflow-hidden">
        <div className="grid items-center gap-12 md:grid-cols-[1fr_auto] md:gap-16">
          <SectionTitle
            align="left"
            title="Un día en tu negocio, en 20 segundos"
            description="Desde que abres en la mañana hasta que cierras la caja en la noche: así se ve OrdenSimple en uso."
          />
          <VideoDemo
            src="/videos/un-dia-con-ordensimple.mp4"
            poster="/videos/un-dia-con-ordensimple.webp"
            label="Video: un día en un negocio usando OrdenSimple, desde abrir en la mañana hasta cerrar la caja en la noche."
          />
        </div>
      </Section>
      <CtaSection title="Comienza gratis y organiza tu negocio hoy." text="Crea tu cuenta en 2 minutos y registra tu primera venta." />
    </>
  )
}
