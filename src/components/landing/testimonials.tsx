import Image from "next/image"
import { Container } from "@/components/landing/sections"

/**
 * "Negocios que crecen con OrdenSimple": testimonios de clientes reales, publicados con su permiso.
 * Para agregar uno, súmalo a TESTIMONIALS (la foto o el logo va en /public/testimonios). Mientras la lista esté vacía,
 * la sección no aparece: nunca se muestran testimonios de ejemplo como si fueran clientes.
 */
type Testimonial = {
  business: string
  kind: string
  quote: string
  /** Nombre de quien habla, solo si autorizó publicarlo. */
  person?: string
  /** Ruta en /public, por ejemplo "/testimonios/almacen-rosita.jpg". */
  image?: string
  /** Funciones de OrdenSimple que usa, en palabras simples. */
  uses: string[]
}

const TESTIMONIALS: Testimonial[] = []

export function Testimonials() {
  if (!TESTIMONIALS.length) return null
  return (
    <section aria-labelledby="testimonios-titulo" className="border-t bg-muted/30">
      <Container className="py-16 md:py-24">
        <h2 id="testimonios-titulo" data-split className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-[3.25rem] sm:leading-[1.04]">
          Negocios que crecen con OrdenSimple
        </h2>
        <ul data-stagger className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <li key={t.business} className="flex flex-col rounded-2xl border bg-card p-6">
              <blockquote className="flex-1 text-pretty">“{t.quote}”</blockquote>
              <div className="mt-5 flex items-center gap-3 border-t pt-4">
                {t.image ? <Image src={t.image} alt={`Logo de ${t.business}`} width={48} height={48} className="size-12 rounded-full object-cover" /> : null}
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{t.business}</p>
                  <p className="text-muted-foreground">
                    {t.kind}
                    {t.person ? `, ${t.person}` : ""}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Usa: {t.uses.join(", ")}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
