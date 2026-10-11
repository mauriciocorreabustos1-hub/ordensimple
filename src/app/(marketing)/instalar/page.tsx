import type { Metadata } from "next"
import { CtaSection, PageHero, Section } from "@/components/landing/sections"
import { InstallGuide } from "@/components/landing/install-guide"

export const metadata: Metadata = {
  title: "Instalar en tu celular",
  description:
    "OrdenSimple no está en App Store ni Google Play, pero puedes agregarla a la pantalla de inicio de tu iPhone o Android y usarla como una app.",
  alternates: { canonical: "/instalar" },
}

export default function InstallPage() {
  return (
    <>
      <PageHero
        eyebrow="iPhone y Android"
        title="Tenla en tu celular, como una app"
        description="OrdenSimple no está en App Store ni Google Play, pero no la necesitas de ahí: la agregas a tu pantalla de inicio en 4 pasos y se abre con un toque, a pantalla completa. Es gratis y no ocupa espacio."
      />
      <Section className="border-t-0">
        <InstallGuide />
      </Section>
      <CtaSection title="¿Todavía no tienes cuenta?" text="Créala gratis y después agrégala a tu celular." />
    </>
  )
}
