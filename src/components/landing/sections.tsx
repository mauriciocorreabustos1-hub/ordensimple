import Link from "next/link"
import { Check, Minus, X } from "lucide-react"
import { BILLING_ENABLED } from "@/lib/plans"
import { ONLINE_FEE_RATE } from "@/lib/online-payments"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { PLANS } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { BEFORE_AFTER, PLAN_COMPARISON, RECEIPT_STEPS, STEPS, type FaqGroup, type Feature } from "@/components/landing/content"
import { AnimatedTitle } from "@/components/landing/animated-title"
import { PriceTag } from "@/components/landing/price-tag"
import { SignupLink } from "@/components/landing/signup-link"

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
  align = "left",
  animated,
}: {
  /** Ya no se muestra (quedaba con cara de plantilla); se mantiene para no tocar cada página. */
  eyebrow?: string
  title: string
  description?: string
  align?: "center" | "left"
  /** El título entra línea por línea la primera vez que aparece en pantalla. */
  animated?: boolean
}) {
  const titleClass = "font-display text-3xl font-semibold tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1]"
  return (
    <div className={cn("max-w-2xl space-y-3", align === "center" && "mx-auto text-center")}>
      {animated ? (
        <AnimatedTitle text={title} align={align} className={titleClass} />
      ) : (
        <h2 className={titleClass}>{title}</h2>
      )}
      {description ? <p className="text-lg text-pretty text-muted-foreground">{description}</p> : null}
    </div>
  )
}

/** Encabezado de las páginas internas (/funciones, /precios, etc.). */
export function PageHero({
  title,
  description,
}: {
  /** Ya no se muestra (la etiqueta chica sobre el título se veía de plantilla); se mantiene para no tocar cada página. */
  eyebrow?: string
  title: string
  description: string
}) {
  return (
    <section className="border-b bg-accent/30">
      <Container className="pt-14 pb-12 md:pt-20 md:pb-16">
        <div className="max-w-3xl space-y-5">
          <h1 className="font-display text-[2.4rem] leading-[1.04] font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.02]">
            {title}
          </h1>
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
    <div className="mt-10 flex">
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

/** "Empieza en 2 minutos" como un comprobante: cada paso con lo que tarda, y el total al final. */
export function ReceiptSteps() {
  return (
    <div className="mx-auto w-full max-w-sm drop-shadow-xl md:rotate-1">
      <div className="receipt-edge bg-card px-6 pt-7 pb-10 font-mono text-sm text-card-foreground">
        <div className="space-y-1 text-center">
          <p className="text-base font-semibold">OrdenSimple</p>
          <p className="text-xs text-muted-foreground">Comprobante de inicio · N° 000001</p>
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

/** Minuto en que empieza cada paso (suman los 2 minutos que promete la página). */
const STOPWATCH = ["00:00", "00:30", "01:30", "01:50"]

export function StepsGrid({ detailed = false }: { detailed?: boolean }) {
  if (detailed) {
    return (
      <ol className="max-w-3xl border-t border-foreground/80">
        {STEPS.map((s, i) => (
          <li key={s.n} className="grid gap-2 border-b py-6 sm:grid-cols-[6.5rem_1fr] sm:gap-8 sm:py-8">
            <span className="tabular pt-1.5 font-mono text-sm text-muted-foreground">{STOPWATCH[i]}</span>
            <div className="space-y-2">
              <p className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{s.title}</p>
              <p className="max-w-xl text-pretty text-muted-foreground">{s.detail}</p>
            </div>
          </li>
        ))}
        <li className="grid gap-2 py-6 sm:grid-cols-[6.5rem_1fr] sm:gap-8 sm:py-8">
          <span className="tabular pt-1.5 font-mono text-sm font-semibold text-primary">02:00</span>
          <p className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Listo. Ya estás ordenado.</p>
        </li>
      </ol>
    )
  }
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
/** Lo que limita cada plan, sacado de PLANS: personas, negocios y productos. */
function planLimits(plan: (typeof PLANS)[keyof typeof PLANS]) {
  const people = plan.maxMembers <= 1 ? "Solo tú" : plan.maxMembers >= 1000 ? "Trabajadores sin límite" : `Tú + ${plan.maxMembers - 1} trabajadores`
  const places = plan.maxBusinesses <= 1 ? "1 negocio" : `Hasta ${plan.maxBusinesses} sucursales`
  const products = plan.maxProducts === null ? "Productos ilimitados" : `Hasta ${plan.maxProducts} productos`
  return [people, places, products]
}

/** Lo que ya dicen los límites de arriba de la tarjeta (personas, sucursales y productos): no se repite en la lista. */
const LIMIT_LINE = /^(1 negocio, solo tú|Hasta \d+ productos|Productos ilimitados|Tú \+ \d+ trabajadores( y hasta \d+ sucursales)?|Trabajadores sin límite|Hasta \d+ sucursales)$/

/** Los planes como carteles de almacén: el precio va en su etiqueta y Pro resalta con la carpeta en verde. */
export function PricingCards({ compact = false }: { compact?: boolean }) {
  const MAX = 6
  return (
    <div>
      <div className="mx-auto grid max-w-xl gap-4 lg:max-w-none lg:grid-cols-3 lg:items-start">
        {Object.values(PLANS).map((plan) => {
          const featured = plan.id === "PRO"
          const quiet = featured ? "text-deep-foreground/80" : "text-muted-foreground"
          const line = featured ? "border-deep-foreground/20" : "border-border"
          const lines = plan.highlights.filter((h) => !LIMIT_LINE.test(h))
          const main = lines.slice(0, MAX)
          const rest = lines.slice(MAX)
          return (
            <div key={plan.id} className={cn("flex flex-col rounded-2xl p-6 sm:p-7", featured ? "bg-deep text-deep-foreground shadow-xl lg:-my-3 lg:py-10" : "border bg-card")}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-2xl font-semibold tracking-tight">{plan.name}</h3>
                {featured ? <p className="text-sm font-medium">Recomendado</p> : null}
              </div>
              <p className={cn("mt-1 min-h-11 text-sm text-pretty", quiet)}>{plan.description}</p>

              <div className="mt-5">
                <PriceTag hole={featured ? "bg-deep" : "bg-card"} className={cn("shadow-md", featured ? "bg-deep-foreground text-deep shadow-black/20" : plan.id === "FREE" && "bg-foreground text-background shadow-black/15")}>
                  <span className="font-display text-2xl font-semibold whitespace-nowrap">{plan.priceLabel}</span>
                </PriceTag>
                {plan.priceNote ? <p className={cn("mt-3 text-xs text-pretty", quiet)}>{plan.priceNote}</p> : null}
              </div>

              <p className={cn("mt-5 border-t pt-4 text-sm text-pretty", line)}>
                <span className="font-semibold">Para: </span>
                <span className={quiet}>{plan.audience.charAt(0).toLowerCase() + plan.audience.slice(1)}</span>
              </p>

              <ul aria-label={`Límites del plan ${plan.name}`} className="mt-3 flex flex-wrap gap-1.5">
                {planLimits(plan).map((l) => (
                  <li key={l} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", featured ? "bg-deep-foreground/12" : "bg-muted")}>
                    {l}
                  </li>
                ))}
              </ul>

              <ul className="mt-4 text-sm">
                {(compact ? main : plan.highlights).map((h) => (
                  <li key={h} className={cn("border-t py-2 text-pretty first:border-t-0", line, h.startsWith("Todo lo de") && "font-semibold")}>
                    {h}
                  </li>
                ))}
              </ul>
              {compact && rest.length ? (
                <details className={cn("group border-t text-sm", line)}>
                  <summary className={cn("flex min-h-11 cursor-pointer list-none items-center justify-between font-medium [&::-webkit-details-marker]:hidden", !featured && "text-primary")}>
                    Ver {rest.length} funciones más
                    <span aria-hidden className="transition-transform group-open:rotate-180">⌄</span>
                  </summary>
                  <ul>
                    {rest.map((h) => (
                      <li key={h} className={cn("border-t py-2 text-pretty", line)}>
                        {h}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <div className="mt-auto pt-5">
                {plan.id === "FREE" ? (
                  <Button size="lg" variant="outline" className="h-11 w-full" asChild>
                    <SignupLink loggedInLabel="Ir a mi negocio">Comenzar gratis</SignupLink>
                  </Button>
                ) : plan.id === "PRO" ? (
                  <Button size="lg" className="h-11 w-full bg-deep-foreground text-deep hover:bg-deep-foreground/90" asChild>
                    {/* Enlace normal (no Link): /pagar/... es una redirección del servidor, no una página. */}
                    <a href={BILLING_ENABLED ? "/pagar/pro" : "/registro"}>{BILLING_ENABLED ? "Elegir Pro" : "Usar Pro gratis"}</a>
                  </Button>
                ) : BILLING_ENABLED ? (
                  <Button size="lg" variant="outline" className="h-11 w-full" asChild>
                    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- /pagar es una redirección del servidor, no una página */}
                    <a href="/pagar/empresa">Elegir Empresa</a>
                  </Button>
                ) : (
                  <Button size="lg" variant="outline" className="h-11 w-full" disabled>
                    Muy pronto
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-6 max-w-3xl text-sm text-pretty text-muted-foreground">
        Precios en pesos chilenos. Los planes pagados se renuevan cada mes y los cancelas cuando quieras. Si cobras con tarjeta por Mercado Pago, OrdenSimple cobra un {Math.round(ONLINE_FEE_RATE * 100)} % de cada pago, aparte de la comisión de Mercado Pago.
      </p>
    </div>
  )
}

function ComparisonValue({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto size-4 text-primary" aria-label="Incluido" />
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/60" aria-label="No incluido" />
  return <span>{value}</span>
}

export function PricingComparison() {
  const plans = Object.values(PLANS)
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-left text-xs sm:text-sm md:min-w-[560px]">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-3 font-medium text-muted-foreground sm:px-5 sm:py-4">Compara los planes</th>
            {plans.map((p) => (
              <th key={p.id} className="px-2 py-3 text-center font-semibold sm:px-4 sm:py-4">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLAN_COMPARISON.map((row) => (
            <tr key={row.label} className="border-b last:border-0">
              <td className="px-3 py-2.5 sm:px-5 sm:py-3">{row.label}</td>
              {row.values.map((v, i) => (
                <td key={i} className="px-2 py-2.5 text-center sm:px-4 sm:py-3">
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
  users,
}: {
  title?: string
  text?: string
  /** Personas con cuenta: si viene, se muestra "Únete a las N personas…". */
  users?: number | null
}) {
  return (
    <section className="bg-deep text-deep-foreground">
      <Container className="grid items-end gap-8 py-16 md:grid-cols-[1fr_auto] md:py-20">
        <div className="max-w-xl space-y-3">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1]">{title}</h2>
          <p className="text-lg text-deep-foreground/75">{text}</p>
          {users && users > 1 ? (
            <p className="text-deep-foreground/90">
              Únete a las <span className="tabular font-semibold">{users.toLocaleString("es-CL")}</span> personas que ya lo usan.
            </p>
          ) : null}
        </div>
        <div className="space-y-2 md:text-right">
          <Button size="lg" className="h-12 w-full bg-deep-foreground px-6 text-base text-deep hover:bg-deep-foreground/90 sm:w-auto" asChild>
            <SignupLink loggedInLabel="Ir a mi negocio">Crear mi cuenta gratis</SignupLink>
          </Button>
          <p className="text-sm text-deep-foreground/70">Gratis para siempre, sin tarjeta.</p>
        </div>
      </Container>
    </section>
  )
}
