import Link from "next/link"
import { NotebookStrike } from "@/components/landing/notebook-strike"
import { Check, Minus } from "lucide-react"
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
  const titleClass = "font-display text-3xl font-semibold tracking-tight text-balance sm:text-[3.25rem] sm:leading-[1.04]"
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
    <section className="ruled-page">
      <Container className="pt-[calc(var(--line)*2)] pb-[calc(var(--line)*2)]">
        <div className="max-w-4xl space-y-[var(--line)] pl-5 sm:pl-8">
          <h1 className="font-display text-[2.5rem] leading-[48px] font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[72px] lg:text-[4.1rem] lg:leading-[84px]">
            {title}
          </h1>
          <p className="max-w-2xl text-pretty text-foreground/80 leading-[var(--line)] lg:text-lg">{description}</p>
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
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-[3.25rem] sm:leading-[1.04]">
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
        {/* Lo que dice la app, impreso como boleta: la jerga tachada y la frase que se entiende. */}
        <figure className="mx-auto w-full max-w-md drop-shadow-2xl">
          <div className="receipt-edge bg-[#fbfaf6] px-6 pt-7 pb-12 text-[#13201c] sm:px-8">
            <p className="font-mono text-sm text-[#5b6b66] line-through decoration-[#5b6b66]/60">Margen neto del período: 18,4%</p>
            <blockquote className="font-display mt-4 text-2xl leading-snug font-semibold text-balance sm:text-3xl">
              De cada $10.000 que vendes, te quedan $1.840.
            </blockquote>
            <figcaption className="mt-4 border-t border-dashed border-[#13201c]/25 pt-3 font-mono text-xs text-[#5b6b66]">Así te lo muestra OrdenSimple en el Inicio.</figcaption>
          </div>
        </figure>
      </div>
    </Section>
  )
}

/** "El cuaderno vs. OrdenSimple": situaciones reales de un negocio de barrio, antes y después. */
/** Hoja de cuaderno contra OrdenSimple: al bajar, cada problema se tacha a lápiz y su solución se marca. */
export function BeforeAfter() {
  return <NotebookStrike rows={BEFORE_AFTER} />
}

/** "Empieza en 2 minutos" como un comprobante: cada paso con lo que tarda, y el total al final. */
export function ReceiptSteps() {
  return (
    <div className="mx-auto w-full max-w-sm drop-shadow-2xl">
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

/** Cada plan es una carpeta del archivador: el nombre va en su pestaña, el precio en su etiqueta y Pro es la carpeta verde. */
export function PricingCards({ compact = false }: { compact?: boolean }) {
  const MAX = 6
  return (
    <div>
      <div className="mx-auto grid max-w-xl gap-6 lg:max-w-none lg:grid-cols-3 lg:items-start lg:gap-4">
        {Object.values(PLANS).map((plan) => {
          const featured = plan.id === "PRO"
          const quiet = featured ? "text-deep-foreground/80" : "text-muted-foreground"
          const line = featured ? "border-deep-foreground/20" : "border-border"
          const lines = plan.highlights.filter((h) => !LIMIT_LINE.test(h))
          const main = lines.slice(0, MAX)
          const rest = lines.slice(MAX)
          return (
            <div key={plan.id} className="flex h-full flex-col">
              <div
                className={cn(
                  "relative z-10 -mb-px flex w-fit items-baseline gap-3 rounded-t-xl px-5 pt-2.5 pb-2",
                  featured ? "bg-deep text-deep-foreground" : "border border-b-0 bg-card",
                  plan.id === "FREE" && "border-t-[3px] border-t-primary",
                  plan.id === "BUSINESS" && "border-t-[3px] border-t-deep",
                )}
              >
                <h3 className="font-display text-2xl font-semibold tracking-tight">{plan.name}</h3>
                {featured ? <p className="text-sm font-medium text-deep-foreground/80">Recomendado</p> : null}
              </div>
            <div className={cn("flex flex-1 flex-col rounded-2xl rounded-tl-none p-6 sm:p-7", featured ? "bg-deep text-deep-foreground shadow-xl" : "border bg-card")}>
              <p className={cn("min-h-11 text-sm text-pretty", quiet)}>{plan.description}</p>

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
                {(compact ? main : lines).map((h) => (
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
            </div>
          )
        })}
      </div>
      <p className="mt-6 max-w-3xl text-sm text-pretty text-muted-foreground">
        Precios en pesos chilenos. Los planes pagados se renuevan cada mes y los cancelas cuando quieras. Si cobras con tarjeta por Mercado Pago, OrdenSimple cobra un {Math.round(ONLINE_FEE_RATE * 100)} % de cada pago, aparte de la comisión de Mercado Pago.
      </p>
      {compact ? null : (
        <p className="mt-4 max-w-3xl rounded-lg border border-dashed border-foreground/30 px-4 py-3 text-sm text-pretty">
          <strong className="font-semibold">¿Compraste el Plan Pro permanente en Mercado Libre?</strong> Crea tu cuenta gratis desde la página web o el computador, entra a Tu plan e ingresa tu código en Canjear código.
        </p>
      )}
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
    <Accordion type="single" collapsible className="border-t border-foreground/80">
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
    // El cierre de la página: la invitación sobre el verde oscuro que sigue en el pie.
    <section className="bg-deep">
      <Container className="py-16 md:py-24">
        <div className="mx-auto max-w-2xl rounded-2xl bg-card text-card-foreground shadow-2xl">
          <div>
            <div className="space-y-4 px-6 py-10 text-center sm:px-12">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl sm:leading-[1.1]">{title}</h2>
              <p className="text-pretty text-muted-foreground">{text}</p>
              {users && users > 1 ? (
                <p>
                  Únete a las <span className="tabular font-semibold">{users.toLocaleString("es-CL")}</span> personas que ya lo usan.
                </p>
              ) : null}
              <Button size="lg" className="h-12 w-full px-6 text-base sm:w-auto" asChild>
                <SignupLink loggedInLabel="Ir a mi negocio">Crear mi cuenta gratis</SignupLink>
              </Button>
              <p className="text-sm text-muted-foreground">Gratis para siempre, sin tarjeta.</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
