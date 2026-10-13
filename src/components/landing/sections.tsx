import Link from "next/link"
import { Check, Minus, Users, X } from "lucide-react"
import { BILLING_ENABLED } from "@/lib/plans"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { PLANS } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { BEFORE_AFTER, PLAN_COMPARISON, RECEIPT_STEPS, STEPS, type FaqGroup, type Feature } from "@/components/landing/content"

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
  title,
  description,
  align = "center",
}: {
  /** Ya no se muestra (quedaba con cara de plantilla); se mantiene para no tocar cada página. */
  eyebrow?: string
  title: string
  description?: string
  align?: "center" | "left"
}) {
  return (
    <div className={cn("max-w-2xl space-y-3", align === "center" && "mx-auto text-center")}>
      <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1]">{title}</h2>
      {description ? <p className="text-lg text-pretty text-muted-foreground">{description}</p> : null}
    </div>
  )
}

/** Encabezado de las páginas internas (/funciones, /precios, etc.). */
export function PageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="border-b bg-accent/30">
      <Container className="pt-12 pb-10 md:pt-16 md:pb-14">
        <div className="max-w-3xl space-y-4">
          {eyebrow ? <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p> : null}
          <h1 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl sm:leading-[1.05]">{title}</h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{description}</p>
        </div>
      </Container>
    </section>
  )
}

export function FeatureGrid({ items, columns = 3 }: { items: Feature[]; columns?: 2 | 3 | 4 }) {
  return (
    <div className={cn("grid gap-x-8 gap-y-6 sm:grid-cols-2", columns === 3 && "lg:grid-cols-3", columns === 4 && "lg:grid-cols-4")}>
      {items.map((f) => (
        <div key={f.title} className="flex gap-3 border-t pt-4">
          <f.icon className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-semibold">{f.title}</p>
            <p className="text-sm text-pretty text-muted-foreground">{f.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div className="mt-10 flex justify-center">
      <Button variant="outline" size="lg" className="h-11 px-5" asChild>
        <Link href={href}>{children}</Link>
      </Button>
    </div>
  )
}

export function BenefitsSection() {
  return (
    <Section className="border-t-0 bg-deep text-deep-foreground">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <div className="space-y-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1]">
            Entiende tus números, aunque no te gusten los números.
          </h2>
          <p className="text-lg text-pretty text-deep-foreground/75">
            Nada de “margen neto” ni planillas. OrdenSimple te lo dice como te lo diría un amigo que sabe de negocios.
          </p>
          <ul className="space-y-2 pt-2 text-pretty">
            <li className="flex gap-2">
              <Check className="mt-1 size-4 shrink-0 text-deep-foreground/80" />
              Anotar el día te toma menos de un minuto.
            </li>
            <li className="flex gap-2">
              <Check className="mt-1 size-4 shrink-0 text-deep-foreground/80" />
              Tus datos son solo tuyos y de quien tú autorices.
            </li>
          </ul>
        </div>
        <figure className="rounded-2xl bg-card p-6 text-card-foreground shadow-lg sm:p-8">
          <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/50">Margen neto del período: 18,4%</p>
          <blockquote className="font-display mt-4 text-2xl leading-snug font-semibold text-balance sm:text-3xl">
            De cada $10.000 que vendes, te quedan $1.840.
          </blockquote>
          <figcaption className="mt-4 text-sm text-muted-foreground">Así te lo muestra OrdenSimple en el Inicio.</figcaption>
        </figure>
      </div>
    </Section>
  )
}

/** "El cuaderno vs. OrdenSimple": situaciones reales de un negocio de barrio, antes y después. */
export function BeforeAfter() {
  // A la izquierda, una hoja de cuaderno de verdad (líneas y margen); a la derecha, lo mismo con OrdenSimple.
  // Todo con alto de línea de 28px para que el texto quede sobre las líneas.
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="hidden grid-cols-2 border-b text-sm font-medium sm:grid">
        <p className="bg-muted/40 py-3.5 pr-5 pl-12 leading-7 text-muted-foreground">Con el cuaderno</p>
        <p className="border-l px-5 py-3.5 leading-7">Con OrdenSimple</p>
      </div>
      <ul>
        {BEFORE_AFTER.map((row) => (
          <li key={row.after} className="grid sm:grid-cols-2">
            <p className="notebook relative bg-muted/40 py-3.5 pr-5 pl-12 leading-7 text-pretty text-muted-foreground">
              <X className="absolute top-[1.3rem] left-3 size-4 text-danger/60" aria-hidden />
              <span className="sr-only">Antes: </span>
              {row.before}
            </p>
            <p className="flex gap-2.5 px-5 py-3.5 leading-7 font-medium text-pretty shadow-[inset_0_-1px_0_var(--border)] sm:border-l">
              <Check className="mt-1.5 size-4 shrink-0 text-primary" />
              {row.after}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "Empieza en 2 minutos" como una boleta: cada paso con lo que tarda, y el total al final. */
export function ReceiptSteps() {
  return (
    <div className="mx-auto w-full max-w-sm drop-shadow-xl md:rotate-1">
      <div className="receipt-edge bg-card px-6 pt-7 pb-10 font-mono text-sm text-card-foreground">
        <div className="space-y-1 text-center">
          <p className="text-base font-semibold">OrdenSimple</p>
          <p className="text-xs text-muted-foreground">Boleta de inicio · N° 000001</p>
        </div>
        <ol className="my-5 space-y-4 border-y border-dashed border-foreground/25 py-5">
          {RECEIPT_STEPS.map((s, i) => (
            <li key={s.what}>
              <p className="flex items-baseline">
                <span className="mr-2 text-muted-foreground">{i + 1}</span>
                <span className="font-medium">{s.what}</span>
                <span className="mx-2 flex-1 translate-y-[-3px] border-b border-dotted border-foreground/30" aria-hidden />
                <span className="tabular shrink-0">{s.time}</span>
              </p>
              <p className="mt-0.5 pl-5 text-xs text-muted-foreground">{s.note}</p>
            </li>
          ))}
        </ol>
        <div className="space-y-1.5">
          <p className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>2 min</span>
          </p>
          <p className="flex justify-between">
            <span>Te cobramos</span>
            <span className="tabular font-semibold text-primary">$0</span>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">¡Gracias por su preferencia!</p>
      </div>
    </div>
  )
}

export function StepsGrid({ detailed = false }: { detailed?: boolean }) {
  return (
    <ol className={cn("grid gap-x-8 gap-y-8 sm:grid-cols-2", !detailed && "lg:grid-cols-4")}>
      {STEPS.map((s) => (
        <li key={s.n} className="space-y-2 border-t-2 border-foreground/80 pt-4">
          <span className="font-display tabular block text-4xl font-semibold text-primary">{s.n.padStart(2, "0")}</span>
          <p className="text-lg font-semibold">{s.title}</p>
          <p className="text-pretty text-muted-foreground">{detailed ? s.detail : s.text}</p>
        </li>
      ))}
    </ol>
  )
}

/** En la portada (`compact`) cada plan muestra lo principal; el detalle está en /precios. */
export function PricingCards({ compact = false }: { compact?: boolean }) {
  const MAX = 6
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
            <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
              <Users className="mt-px size-3.5 shrink-0 text-primary" />
              <span>
                <span className="font-medium">Ideal para:</span> {plan.audience.charAt(0).toLowerCase() + plan.audience.slice(1)}
              </span>
            </p>
            <div className="space-y-1">
              <p className="text-3xl font-semibold tracking-tight">{plan.priceLabel}</p>
              {plan.priceNote ? <p className="text-xs text-muted-foreground">{plan.priceNote}</p> : null}
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {(compact ? plan.highlights.slice(0, MAX) : plan.highlights).map((h) => (
                <li key={h} className={cn("flex items-start gap-2", h.startsWith("Todo lo de") && "font-medium")}>
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {h}
                </li>
              ))}
              {compact && plan.highlights.length > MAX ? (
                <li className="pl-6">
                  <Link href="/precios" className="text-primary hover:underline">
                    Y {plan.highlights.length - MAX} cosas más
                  </Link>
                </li>
              ) : null}
            </ul>
            {plan.id === "FREE" ? (
              <Button size="lg" variant={featured ? "default" : "outline"} className="h-11" asChild>
                <Link href="/registro">Comenzar gratis</Link>
              </Button>
            ) : plan.id === "PRO" ? (
              <Button size="lg" className="h-11" asChild>
                {/* Enlace normal (no Link): /pagar/... es una redirección del servidor, no una página. */}
                <a href={BILLING_ENABLED ? "/pagar/pro" : "/registro"}>{BILLING_ENABLED ? "Elegir Pro" : "Usar Pro gratis"}</a>
              </Button>
            ) : BILLING_ENABLED ? (
              <Button size="lg" variant="outline" className="h-11" asChild>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- /pagar es una redirección del servidor, no una página */}
                <a href="/pagar/empresa">Elegir Empresa</a>
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
    <section className="bg-deep text-deep-foreground">
      <Container className="grid items-end gap-8 py-16 md:grid-cols-[1fr_auto] md:py-20">
        <div className="max-w-xl space-y-3">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1]">{title}</h2>
          <p className="text-lg text-deep-foreground/75">{text}</p>
        </div>
        <div className="space-y-2 md:text-right">
          <Button size="lg" className="h-12 w-full bg-deep-foreground px-6 text-base text-deep hover:bg-deep-foreground/90 sm:w-auto" asChild>
            <Link href="/registro">Crear mi cuenta gratis</Link>
          </Button>
          <p className="text-sm text-deep-foreground/70">Gratis para siempre, sin tarjeta.</p>
        </div>
      </Container>
    </section>
  )
}
