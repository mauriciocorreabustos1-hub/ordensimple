import Link from "next/link"
import { ArrowRight, Check, Minus, Sparkles } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { PLANS } from "@/lib/plans"
import { cn } from "@/lib/utils"
import {
  BENEFITS,
  PLAN_COMPARISON,
  STEPS,
  type FaqGroup,
  type Feature,
} from "@/components/landing/content"

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto max-w-6xl px-4 sm:px-6", className)}>{children}</div>
}

export function Section({
  className,
  muted,
  children,
  id,
}: {
  className?: string
  muted?: boolean
  children: React.ReactNode
  id?: string
}) {
  return (
    <section id={id} className={cn("border-t", muted && "bg-muted/30", className)}>
      <Container className="py-16 md:py-24">{children}</Container>
    </section>
  )
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string
  title: string
  description?: string
  align?: "center" | "left"
}) {
  return (
    <div className={cn("max-w-2xl space-y-3", align === "center" && "mx-auto text-center")}>
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {description ? <p className="text-lg text-pretty text-muted-foreground">{description}</p> : null}
    </div>
  )
}

/** Encabezado de las páginas internas (/funciones, /precios, etc.). */
export function PageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_70%)]" />
      <Container className="pt-14 pb-12 text-center md:pt-20 md:pb-16">
        <div className="mx-auto max-w-3xl space-y-5">
          <p className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            {eyebrow}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
          <p className="mx-auto max-w-2xl text-lg text-pretty text-muted-foreground">{description}</p>
        </div>
      </Container>
    </section>
  )
}

export function FeatureGrid({ items, columns = 3 }: { items: Feature[]; columns?: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "lg:grid-cols-4",
      )}
    >
      {items.map((f) => (
        <div key={f.title} className="space-y-3 rounded-2xl border bg-card p-5 text-center sm:text-left">
          <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary sm:mx-0">
            <f.icon className="size-5" />
          </span>
          <p className="font-semibold">{f.title}</p>
          <p className="text-sm text-muted-foreground">{f.text}</p>
        </div>
      ))}
    </div>
  )
}

export function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div className="mt-10 flex justify-center">
      <Button variant="outline" size="lg" className="h-11 px-5" asChild>
        <Link href={href}>
          {children}
          <ArrowRight />
        </Link>
      </Button>
    </div>
  )
}

export function BenefitsSection() {
  return (
    <Section>
      <SectionTitle eyebrow="Beneficios" title="Entiende tus números, aunque no te gusten los números" />
      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title} className="space-y-3 text-center md:text-left">
            <b.icon className="mx-auto size-6 text-primary md:mx-0" />
            <p className="text-lg font-semibold">{b.title}</p>
            <p className="text-muted-foreground">{b.text}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function StepsGrid({ detailed = false }: { detailed?: boolean }) {
  return (
    <ol className={cn("grid gap-4 sm:grid-cols-2", !detailed && "lg:grid-cols-4")}>
      {STEPS.map((s) => (
        <li key={s.n} className="space-y-3 rounded-2xl border bg-card p-5 text-center sm:text-left md:p-6">
          <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground sm:mx-0">
            {s.n}
          </span>
          <p className="font-semibold">{s.title}</p>
          <p className="text-sm text-muted-foreground">{detailed ? s.detail : s.text}</p>
        </li>
      ))}
    </ol>
  )
}

export function PricingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Object.values(PLANS).map((plan) => {
        const featured = plan.id === "PRO"
        return (
          <div
            key={plan.id}
            className={cn(
              "flex flex-col gap-5 rounded-2xl border bg-card p-6",
              featured && "border-primary ring-1 ring-primary md:-my-2 md:py-8",
            )}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">{plan.name}</p>
                {featured ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Recomendado</span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-semibold tracking-tight">
                {plan.priceLabel}
                {plan.id === "FREE" ? <span className="text-base font-normal text-muted-foreground"> /mes</span> : null}
              </p>
              {plan.priceNote ? <p className="text-xs text-muted-foreground">{plan.priceNote}</p> : null}
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {plan.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {h}
                </li>
              ))}
            </ul>
            {plan.id === "FREE" ? (
              <Button size="lg" variant={featured ? "default" : "outline"} className="h-11" asChild>
                <Link href="/registro">Comenzar gratis</Link>
              </Button>
            ) : plan.id === "PRO" ? (
              <Button size="lg" className="h-11" asChild>
                <Link href="/registro">Usar Pro gratis</Link>
              </Button>
            ) : (
              <Button size="lg" variant="outline" className="h-11" disabled>
                Muy pronto
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ComparisonValue({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto size-4 text-primary" aria-label="Incluido" />
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/60" aria-label="No incluido" />
  return <span className="text-sm">{value}</span>
}

export function PricingComparison() {
  const plans = Object.values(PLANS)
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-5 py-4 text-sm font-medium text-muted-foreground">Compara los planes</th>
            {plans.map((p) => (
              <th key={p.id} className="px-4 py-4 text-center text-sm font-semibold">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLAN_COMPARISON.map((row) => (
            <tr key={row.label} className="border-b last:border-0">
              <td className="px-5 py-3 text-sm">{row.label}</td>
              {row.values.map((v, i) => (
                <td key={i} className="px-4 py-3 text-center">
                  <ComparisonValue value={v} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FaqList({ items }: { items: FaqGroup["items"] }) {
  return (
    <Accordion type="single" collapsible className="rounded-2xl border bg-card px-5">
      {items.map((f, i) => (
        <AccordionItem key={f.q} value={`q${i}`}>
          <AccordionTrigger className="text-base">{f.q}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

export function CtaSection({
  title = "Tu negocio merece estar ordenado.",
  text = "Crea tu cuenta gratis y registra tu primera venta hoy.",
}: {
  title?: string
  text?: string
}) {
  return (
    <section className="border-t">
      <Container className="py-16 md:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,oklch(1_0_0/0.18),transparent_50%)]" />
          <div className="relative mx-auto max-w-xl space-y-5">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
            <p className="text-primary-foreground/85">{text}</p>
            <Button size="lg" variant="secondary" className="h-12 px-6 text-base" asChild>
              <Link href="/registro">
                Comenzar gratis
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  )
}
