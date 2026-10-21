import Link from "next/link"
import { ArrowRight, Calculator, Scale, Tag, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Container, CtaSection, PageHero } from "@/components/landing/sections"
import { cn } from "@/lib/utils"
import { SignupLink } from "@/components/landing/signup-link"

export const CALCULATORS = [
  {
    href: "/calculadoras/precio-de-venta",
    title: "Precio de venta",
    description: "¿A cuánto vender para ganar lo que quieres? Con el margen bien calculado.",
    icon: Tag,
  },
  {
    href: "/calculadoras/punto-de-equilibrio",
    title: "Punto de equilibrio",
    description: "¿Cuánto tienes que vender al mes y al día para no perder plata?",
    icon: Scale,
  },
  {
    href: "/calculadoras/meta-de-ganancia",
    title: "Meta de ganancia",
    description: "Si quieres ganar cierta plata al mes, ¿cuánto tienes que vender?",
    icon: Target,
  },
] as const

/** Bloque de explicación con título (lo que leen las personas y Google bajo la calculadora). */
export function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 leading-relaxed text-foreground/85 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-foreground [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}

/** Recuadro con una fórmula o un ejemplo con números. */
export function Formula({ children }: { children: React.ReactNode }) {
  return <div className="tabular rounded-2xl border bg-muted/40 px-5 py-4 font-medium text-foreground">{children}</div>
}

export function OtherCalculators({ current }: { current?: string }) {
  const others = CALCULATORS.filter((c) => c.href !== current)
  return (
    <div className={cn("grid gap-3", others.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      {others.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="group flex items-start gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <c.icon className="size-5" />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="flex items-center gap-1 font-semibold group-hover:text-primary">
              {c.title}
              <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
            <span className="block text-sm text-muted-foreground">{c.description}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

/** Página pública de una calculadora: herramienta arriba, explicación abajo y llamado a crear cuenta. */
export function CalculatorPage({
  current,
  title,
  description,
  calculator,
  children,
}: {
  current: string
  title: string
  description: string
  calculator: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <PageHero eyebrow="Calculadora gratis" title={title} description={description} />
      <Container className="pb-12">{calculator}</Container>

      <Container className="max-w-3xl space-y-10 pb-16">
        {children}

        <div className="flex flex-col items-start gap-4 rounded-3xl border bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-2 font-semibold">
              <Calculator className="size-5 text-primary" />
              Hazlo con los números reales de tu negocio
            </p>
            <p className="text-sm text-muted-foreground">
              En OrdenSimple las calculadoras usan tus ventas, gastos y productos. Gratis para empezar.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 shrink-0 px-5 max-sm:w-full">
            <SignupLink>
              Crear cuenta gratis
              <ArrowRight />
            </SignupLink>
          </Button>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Otras calculadoras</h2>
          <OtherCalculators current={current} />
        </section>
      </Container>

      <CtaSection />
    </>
  )
}
