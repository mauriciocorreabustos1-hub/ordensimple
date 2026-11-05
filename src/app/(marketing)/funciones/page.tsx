import type { Metadata } from "next"
import { COMING_SOON, FEATURE_GROUPS, TOOLS } from "@/components/landing/content"
import { CtaSection, FeatureGrid, MoreLink, PageHero, Section, SectionTitle } from "@/components/landing/sections"

export const metadata: Metadata = {
  title: "Funciones",
  description:
    "Ventas, gastos, fiado, cierre de caja, inventario, tienda online, agenda y reservas, avisos al celular, reportes en PDF, equipo y calculadoras para tu negocio, explicados en palabras simples.",
  alternates: { canonical: "/funciones" },
}

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Funciones"
        title="Todo lo que tu negocio necesita, en un solo lugar"
        description="Registra lo que vendes y lo que gastas, lleva el fiado, cuadra la caja, recibe pedidos y reservas por internet y sabe cuánto ganas, con avisos que te llegan solos al celular y al correo."
      />

      <Section>
        {/* Índice: salta directo a lo que te interesa. */}
        <nav aria-label="Funciones" className="mb-12 flex flex-wrap gap-x-1 gap-y-2 text-sm">
          {FEATURE_GROUPS.map((g, i) => (
            <span key={g.id} className="flex items-center gap-1">
              {i > 0 ? <span className="text-muted-foreground/50" aria-hidden>·</span> : null}
              <a href={`#${g.id}`} className="inline-flex min-h-8 items-center rounded px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground pointer-coarse:min-h-11">
                {g.title}
              </a>
            </span>
          ))}
        </nav>
        <div className="border-t border-foreground/80">
          {FEATURE_GROUPS.map((g) => (
            <article key={g.id} id={g.id} className="grid scroll-mt-20 gap-5 border-b py-8 md:grid-cols-[17rem_1fr] md:gap-12 md:py-10">
              <div className="space-y-2">
                <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{g.title}</h2>
                <p className="text-pretty text-muted-foreground">{g.description}</p>
              </div>
              <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
                {g.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[15px] text-pretty">
                    <span className="mt-[0.6rem] h-px w-3 shrink-0 bg-primary" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        {COMING_SOON.length ? (
          <p className="mt-8 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Lo que viene:</span>{" "}
            {COMING_SOON.map((f) => `${f.title.toLowerCase()} (${f.text.charAt(0).toLowerCase() + f.text.slice(1).replace(/\.$/, "")})`).join(", ")}.
          </p>
        ) : null}
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
        <MoreLink href="/calculadoras">Probar las calculadoras gratis</MoreLink>
      </Section>

      <CtaSection title="Pruébalo gratis hoy" text="Crea tu cuenta en menos de un minuto. Sin tarjeta de crédito." />
    </>
  )
}
