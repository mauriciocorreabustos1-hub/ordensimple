import type { Metadata } from "next"
import Link from "next/link"
import { ChefHat, ClipboardList, LayoutGrid, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ComandasPreview } from "@/components/landing/comandas-preview"
import { Container, CtaSection, FaqList, Section, SectionTitle } from "@/components/landing/sections"
import { BILLING_ENABLED, PLANS } from "@/lib/plans"
import { formatMoney } from "@/lib/currency"
import { SignupLink } from "@/components/landing/signup-link"

export const metadata: Metadata = {
  title: "Comandas y cocina para restaurantes y cafés",
  description:
    "Comandas por mesa desde el celular, pantalla para la cocina y cobro que queda como venta. Para restaurantes, cafés, sangucherías y carros de comida en Chile.",
  alternates: { canonical: "/restaurantes" },
}

const STEPS = [
  {
    icon: ClipboardList,
    title: "El garzón anota",
    text: "Abre la comanda de la mesa y toca los platos. Con notas como “sin mayo” o “bien cocido”.",
  },
  {
    icon: ChefHat,
    title: "La cocina lo ve de inmediato",
    text: "Toca “Enviar a cocina” y el pedido aparece en la pantalla de la cocina. Sin papeles ni confusiones.",
  },
  {
    icon: Wallet,
    title: "Cobras y queda anotado",
    text: "Al cobrar queda como venta: descuenta stock, suma a la caja y a tus reportes.",
  },
]

const DETAILS = [
  "Tus mesas, las que quieras (hasta 200), más barra, terraza, para llevar o delivery",
  "Ves qué mesas están ocupadas, hace cuánto se abrieron y cuánto lleva cada una",
  "La cocina ve lo que espera hace más de 15 minutos en amarillo y en rojo a los 25",
  "Si la mesa pide algo más, a la cocina le llega solo lo nuevo",
  "Aviso con sonido cuando entra un pedido y modo pantalla completa para una tablet",
  "Cobra en efectivo, débito, crédito, transferencia o fiado",
  "Funciona en el celular, tablet o computador que ya tienes: no compras nada",
  "Tu equipo con su propia cuenta: garzones y cocina, hasta 20 personas en Pro",
]

const FAQ = [
  {
    q: "¿Necesito comprar una tablet o una impresora?",
    a: "No. Funciona en cualquier celular, tablet o computador con internet. La cocina puede usar un celular viejo o una tablet en pantalla completa.",
  },
  {
    q: "¿Cómo activo las comandas?",
    a: "En Configuración marca el rubro “Restaurante, café o comida” (o escribe el tuyo, como sanguchería o pizzería). Con el plan Pro aparecen Comandas y Cocina en el menú, y ahí mismo eliges cuántas mesas tienes.",
  },
  {
    q: "¿Los garzones ven cuánto gano?",
    a: "No. Tus trabajadores pueden abrir comandas, enviar a cocina y cobrar, pero no ven tus ganancias ni tus reportes.",
  },
  {
    q: "¿Qué pasa con las ventas de las comandas?",
    a: "Cada comanda cobrada queda como una venta normal, con sus productos: se descuenta el stock, se suma al cierre de caja y aparece en tus reportes y en el resumen de los lunes.",
  },
]

export default function RestaurantsPage() {
  const price = PLANS.PRO.monthlyPrice
  return (
    <>
      <section className="border-b bg-accent/30">
        <Container className="grid items-center gap-12 pt-14 pb-14 md:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <h1 className="font-display text-[2.4rem] leading-[1.04] font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.02]">
              Comandas y cocina para tu restaurante
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              El garzón anota desde el celular, la cocina ve el pedido en su pantalla y al cobrar queda todo anotado. Para restaurantes,
              cafés, sangucherías y carros de comida.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-6 text-base" asChild>
                <SignupLink inApp="/dashboard/comandas" loggedInLabel="Ir a mis comandas">Crear mi cuenta gratis</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
                <Link href="/precios">Ver el plan Pro</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Las comandas son parte del plan Pro
              {BILLING_ENABLED && price ? ` (${formatMoney(price, "CLP")} al mes, cancelas cuando quieras)` : ""}.
            </p>
          </div>
          <ComandasPreview />
        </Container>
      </section>

      <Section>
        <SectionTitle title="Así de simple, en tres pasos" />
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="space-y-3 rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </span>
                <span className="tabular text-sm font-medium text-muted-foreground">Paso {i + 1}</span>
              </div>
              <h2 className="font-display text-xl font-semibold">{s.title}</h2>
              <p className="text-pretty text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section muted>
        <div className="grid gap-10 md:grid-cols-[17rem_1fr] md:gap-12">
          <div className="space-y-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LayoutGrid className="size-5" />
            </span>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Hecho para el ritmo de un local</h2>
            <p className="text-pretty text-muted-foreground">Y todo lo demás de OrdenSimple: caja, gastos, inventario y cuánto ganas de verdad.</p>
          </div>
          <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
            {DETAILS.map((d) => (
              <li key={d} className="flex gap-2.5 text-[15px] text-pretty">
                <span className="mt-[0.6rem] h-px w-3 shrink-0 bg-primary" aria-hidden />
                {d}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section>
        <SectionTitle title="Preguntas de restaurantes" />
        <div className="mt-8 max-w-3xl">
          <FaqList items={FAQ} />
        </div>
      </Section>

      <CtaSection title="Ordena tu local desde hoy" text="Crea tu cuenta gratis, marca tu rubro y prueba las comandas con tus mesas." />
    </>
  )
}
