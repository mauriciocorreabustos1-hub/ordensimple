import Link from "next/link"
import {
  ArrowRight,
  Calculator,
  Check,
  Clock,
  FlaskConical,
  HeartHandshake,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { DashboardPreview } from "@/components/landing/dashboard-preview"
import { PLANS } from "@/lib/plans"
import { cn } from "@/lib/utils"

const FEATURES = [
  { icon: ShoppingBag, title: "Ventas en segundos", text: "Anota una venta con solo el monto, o con detalle de productos, cliente y forma de pago." },
  { icon: Receipt, title: "Gastos ordenados", text: "Arriendo, luz, proveedores, sueldos… todo en categorías para saber en qué se va tu plata." },
  { icon: Package, title: "Productos con ganancia", text: "Ingresa costo y precio: te decimos cuánto ganas por unidad, sin fórmulas." },
  { icon: TrendingUp, title: "Tu negocio de un vistazo", text: "Ventas, gastos y ganancia de hoy y del mes, con gráficos simples y comparaciones." },
  { icon: Calculator, title: "¿A cuánto debería vender?", text: "Calcula el precio correcto para ganar lo que necesitas en cada venta." },
  { icon: Target, title: "Metas de ganancia", text: "Dinos cuánto quieres ganar y te decimos cuánto vender al mes, semana y día." },
  { icon: FlaskConical, title: "¿Qué pasa si...?", text: "Simula subir precios, contratar o hacer descuentos antes de arriesgarte." },
  { icon: Smartphone, title: "Funciona en tu celular", text: "Diseñado primero para el teléfono, con botones grandes y fáciles de usar." },
]

const BENEFITS = [
  { icon: Clock, title: "Adiós al Excel", text: "Deja de pelear con planillas. Registrar tu día te toma menos de un minuto." },
  { icon: HeartHandshake, title: "Sin palabras difíciles", text: "En vez de “margen neto 18,4%”, te decimos: por cada $10.000 que vendes, te quedan $1.840." },
  { icon: ShieldCheck, title: "Tus datos, seguros", text: "Cada negocio está separado y protegido. Solo tú y quien autorices pueden verlos." },
]

const STEPS = [
  { n: "1", title: "Crea tu cuenta gratis", text: "Solo tu nombre, correo y una contraseña. Sin tarjeta." },
  { n: "2", title: "Cuéntanos de tu negocio", text: "Nombre, rubro y moneda. Puedes saltarte lo que no sepas." },
  { n: "3", title: "Registra ventas y gastos", text: "Con el botón verde, desde el celular o el computador." },
  { n: "4", title: "Mira cómo te va", text: "Te mostramos tu ganancia y si vas bien, con palabras simples." },
]

const FAQ = [
  { q: "¿Necesito saber de contabilidad?", a: "No. OrdenSimple está hecho para personas que nunca han usado un software administrativo. Todo se explica con palabras simples y ejemplos." },
  { q: "¿Es realmente gratis?", a: "Sí. El plan Gratis incluye ventas, gastos, hasta 50 productos, dashboard y calculadoras, sin costo y sin tarjeta. Los planes Pro y Empresa llegarán pronto." },
  { q: "¿Puedo usarlo desde el celular?", a: "Sí, funciona en cualquier navegador: celular, tablet o computador. Pronto podrás instalarlo como app en tu pantalla de inicio." },
  { q: "¿Reemplaza a mi contador o la boleta del SII?", a: "No. OrdenSimple te ayuda a entender y ordenar tu negocio día a día, pero no emite boletas ni reemplaza tus obligaciones tributarias." },
  { q: "¿Mis datos están seguros?", a: "Cada negocio está aislado: nadie más puede ver tu información. Las contraseñas nunca se guardan en texto plano." },
  { q: "¿Funciona en otros países?", a: "Partimos en Chile con pesos chilenos, pero ya puedes usar dólares, euros, soles, pesos argentinos, colombianos y mexicanos." },
]

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section id="inicio" className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_70%)]" />
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:px-6 md:pt-20 md:pb-24">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <p className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Hecho para emprendedores y pymes de Chile
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
              Administra tu negocio sin complicarte.
            </h1>
            <p className="mx-auto max-w-xl text-lg text-pretty text-muted-foreground">
              Controla tus ventas, gastos, productos y ganancias desde un solo lugar.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-6 text-base" asChild>
                <Link href="/registro">
                  Comenzar gratis
                  <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
                <a href="#como-funciona">Ver cómo funciona</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Gratis para siempre en el plan básico · Sin tarjeta de crédito</p>
          </div>
          <div className="mt-14 md:mt-16">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* Funciones */}
      <section id="funciones" className="scroll-mt-16 border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <SectionTitle eyebrow="Funciones" title="Todo lo que necesitas, nada que te complique" />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="space-y-3 rounded-2xl border bg-card p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </span>
                <p className="font-semibold">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <SectionTitle eyebrow="Beneficios" title="Entiende tus números, aunque no te gusten los números" />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="space-y-3">
                <b.icon className="size-6 text-primary" />
                <p className="text-lg font-semibold">{b.title}</p>
                <p className="text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="scroll-mt-16 border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <SectionTitle eyebrow="Cómo funciona" title="Empieza en 2 minutos" />
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="space-y-3 rounded-2xl border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {s.n}
                </span>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Planes */}
      <section id="precios" className="scroll-mt-16 border-t">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <SectionTitle eyebrow="Precios" title="Empieza gratis. Crece cuando lo necesites." />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
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
                  <p className="text-3xl font-semibold tracking-tight">
                    {plan.priceLabel}
                    {plan.id === "FREE" ? <span className="text-base font-normal text-muted-foreground"> /mes</span> : null}
                  </p>
                  <ul className="flex-1 space-y-2 text-sm">
                    {plan.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        {h}
                      </li>
                    ))}
                  </ul>
                  {plan.id === "FREE" ? (
                    <Button size="lg" className="h-11" asChild>
                      <Link href="/registro">Comenzar gratis</Link>
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
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section id="preguntas" className="scroll-mt-16 border-t bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
          <SectionTitle eyebrow="Preguntas frecuentes" title="¿Tienes dudas?" />
          <Accordion type="single" collapsible className="mt-10 rounded-2xl border bg-card px-5">
            {FAQ.map((f, i) => (
              <AccordionItem key={f.q} value={`q${i}`}>
                <AccordionTrigger className="text-base">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,oklch(1_0_0/0.18),transparent_50%)]" />
            <div className="relative mx-auto max-w-xl space-y-5">
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Tu negocio merece estar ordenado.
              </h2>
              <p className="text-primary-foreground/85">Crea tu cuenta gratis y registra tu primera venta hoy.</p>
              <Button size="lg" variant="secondary" className="h-12 px-6 text-base" asChild>
                <Link href="/registro">
                  Comenzar gratis
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 text-center">
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
    </div>
  )
}
