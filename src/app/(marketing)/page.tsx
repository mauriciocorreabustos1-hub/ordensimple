import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardPreview } from "@/components/landing/dashboard-preview"
import { PriceTag } from "@/components/landing/price-tag"
import { FAQ_GROUPS } from "@/components/landing/content"
import { LegacyHashRedirect } from "@/components/landing/legacy-hash-redirect"
import { StructuredData } from "@/components/landing/structured-data"
import { SocialSection } from "@/components/landing/social-section"
import { ComandasPreview } from "@/components/landing/comandas-preview"
import { StorePreview } from "@/components/landing/store-preview"
import { AgendaPreview } from "@/components/landing/agenda-preview"
import { LabelsPreview } from "@/components/landing/labels-preview"
import { PromosPreview } from "@/components/landing/promos-preview"
import { LoyaltyPreview } from "@/components/landing/loyalty-preview"
import { QuotePreview } from "@/components/landing/quote-preview"
import { RecipesPreview } from "@/components/landing/recipes-preview"
import { TrackingPreview } from "@/components/landing/tracking-preview"
import { getUserCount } from "@/components/landing/user-count"
import { TurnTicket } from "@/components/landing/turn-ticket"
import { VideoDemo } from "@/components/landing/video-demo"
import {
  BeforeAfter,
  BenefitsSection,
  Container,
  CtaSection,
  FaqList,
  MoreLink,
  PricingCards,
  Section,
  SectionTitle,
  ReceiptSteps,
} from "@/components/landing/sections"
import { SignupLink } from "@/components/landing/signup-link"

export const metadata: Metadata = { alternates: { canonical: "/" } }

// Se regenera cada 10 minutos para que el contador de personas esté al día.
export const revalidate = 600

const TOP_FAQ = FAQ_GROUPS.flatMap((g) => g.items).slice(0, 5)

const DAY = [
  { time: "08:30", text: "Abres y ves de inmediato cómo va tu negocio." },
  { time: "13:00", text: "Vendes escaneando los productos con el celular." },
  { time: "21:00", text: "Cierras la caja en 1 minuto y sabes cuánto ganaste." },
]

export default async function LandingPage() {
  const users = await getUserCount()
  return (
    <>
      <StructuredData />
      <LegacyHashRedirect />

      <section className="overflow-hidden border-b bg-accent/30">
        <Container className="grid items-center gap-12 pt-12 pb-14 md:pt-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:pb-20">
          <div className="space-y-6">
            <h1 className="font-display text-[2.6rem] leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl">
              Administra tu negocio sin complicarte.
            </h1>
            <p className="max-w-lg text-lg text-pretty text-muted-foreground">
              Para almacenes, restaurantes, botillerías, peluquerías y ferias: anota ventas, gastos, fiados y productos desde el celular, y sabe cada día
              cuánto estás ganando de verdad.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-6 text-base" asChild>
                <SignupLink loggedInLabel="Ir a mi negocio">Crear mi cuenta gratis</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
                <Link href="/como-funciona">Ver cómo funciona</Link>
              </Button>
            </div>
            {/* Cuántos somos, como número de atención: se actualiza solo cada 10 minutos (ver revalidate arriba). */}
            {users ? <TurnTicket users={users} /> : null}
            <p className="text-sm text-muted-foreground">El plan básico es gratis para siempre y no te pedimos tarjeta.</p>
          </div>
          <div className="relative pt-11 lg:-mr-24 xl:-mr-32">
            <PriceTag className="absolute top-0 left-3 z-10 -rotate-3 sm:left-6">
              <span className="font-display text-3xl font-semibold">$0</span>
              <span className="text-sm font-medium">para empezar</span>
            </PriceTag>
            <DashboardPreview />
          </div>
        </Container>
      </section>

      <Section id="video" className="overflow-hidden">
        <div className="grid items-center gap-12 md:grid-cols-[1fr_auto] md:gap-16">
          <div className="space-y-6">
            <SectionTitle
              align="left"
              eyebrow="Míralo en 20 segundos"
              title="Un día en tu negocio con OrdenSimple"
              description="Sin cuadernos, sin planillas y sin calculadora. Así se ve tu día a día:"
            />
            <ul className="space-y-3">
              {DAY.map((d) => (
                <li key={d.time} className="flex items-start gap-3">
                  <span className="tabular mt-0.5 rounded-md bg-accent px-2 py-0.5 text-sm font-semibold text-accent-foreground">
                    {d.time}
                  </span>
                  <span className="text-pretty">{d.text}</span>
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 text-primary" />
              Funciona en el celular y en el computador.
            </p>
            <Button size="lg" className="h-12 px-6 text-base" asChild>
              <SignupLink loggedInLabel="Ir a mi negocio">Pruébalo gratis</SignupLink>
            </Button>
          </div>
          <VideoDemo
            src="/videos/un-dia-con-ordensimple.mp4"
            poster="/videos/un-dia-con-ordensimple.webp"
            label="Video: un día en un negocio usando OrdenSimple, desde abrir en la mañana hasta cerrar la caja en la noche."
          />
        </div>
      </Section>

      <Section muted>
        <SectionTitle
          align="left"
          title="Lo que cambia cuando dejas el cuaderno"
          description="Las mismas cosas que ya haces en tu negocio, pero sin que se te pierda nada."
        />
        <div className="mt-10">
          <BeforeAfter />
        </div>
        <MoreLink href="/funciones">Ver todas las funciones</MoreLink>
      </Section>

      <BenefitsSection />

      <Section muted>
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="space-y-4">
            <SectionTitle align="left" title="Empieza en 2 minutos" description="Sin instalar nada y sin tarjeta. Esto es todo lo que tienes que hacer." />
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button size="lg" className="h-11" asChild>
                <SignupLink loggedInLabel="Ir a mi negocio">Crear mi cuenta gratis</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-11" asChild>
                <Link href="/como-funciona">Conoce cómo funciona</Link>
              </Button>
            </div>
          </div>
          <ReceiptSteps />
        </div>
      </Section>

      {/* Para restaurantes y cafés: comandas y cocina. */}
      <Section className="overflow-hidden">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <SectionTitle
              align="left"
              title="¿Tienes un restaurante, café o sanguchería?"
              description="Anota las comandas por mesa desde el celular, mándalas a la pantalla de la cocina y cobra al final. Todo queda como venta."
            />
            <ul className="space-y-2 text-[15px]">
              {["Tus mesas, las que quieras, y ves cuáles están ocupadas", "La cocina marca cada plato listo y el garzón lo ve de inmediato", "Carta con QR en cada mesa: piden desde su celular", "La cuenta separada por persona, impresa en tu impresora de boletas", "Sin comprar nada: celular, tablet o computador"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
            <Button size="lg" variant="outline" className="h-11" asChild>
              <Link href="/restaurantes">Ver comandas y cocina</Link>
            </Button>
          </div>
          <ComandasPreview />
        </div>
      </Section>

      {/* Tienda online: catálogo propio con pedidos por WhatsApp. */}
      <Section muted className="overflow-hidden">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5 lg:order-2">
            <SectionTitle
              align="left"
              eyebrow="Tienda online"
              title="¿Vendes por WhatsApp? Ten tu propia página web"
              description="Tus productos con foto, precio y stock en una página con tu nombre. Tus clientes arman el pedido y te llega por WhatsApp, ordenado y listo para despachar. Sin comisiones."
            />
            <ul className="space-y-2 text-[15px]">
              {["Tu dirección: ordensimple.cl/tienda/tu-negocio","Retiro en el local o despacho, con la dirección del cliente","Con un toque el pedido queda como venta y se descuenta el stock","Te avisa al celular apenas entra un pedido","Tu cliente ve en qué va su pedido con un enlace"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="h-11" asChild>
                <SignupLink inApp="/dashboard/configuracion?seccion=tienda" loggedInLabel="Ir a mi tienda">Crear mi tienda</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-11" asChild>
                <Link href="/funciones#tienda">Ver cómo funciona</Link>
              </Button>
            </div>
          </div>
          <StorePreview className="lg:order-1" />
        </div>
      </Section>

      {/* Seguimiento del pedido: el cliente ve en qué va sin preguntar. */}
      <Section className="overflow-hidden">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <SectionTitle
              align="left"
              eyebrow="Seguimiento del pedido"
              title="¿Te preguntan “¿y mi pedido?”? Que lo vean solos"
              description="Cada pedido de tu tienda online trae un enlace donde tu cliente ve en qué va: recibido, en preparación, listo o en camino, y entregado. Tú lo avanzas con un toque."
            />
            <ul className="space-y-2 text-[15px]">
              {["El enlace le llega en su propio mensaje de WhatsApp","La página se actualiza sola, sin descargar nada","Le avisas cada cambio por WhatsApp con el mensaje ya escrito","Incluido en el plan Pro, con tu tienda online"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="h-11" asChild>
                <SignupLink inApp="/dashboard/pedidos" loggedInLabel="Ver mis pedidos">Crear mi tienda</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-11" asChild>
                <Link href="/funciones#tienda">Ver cómo funciona</Link>
              </Button>
            </div>
          </div>
          <TrackingPreview />
        </div>
      </Section>

      {/* Servicios: agenda por profesional y reservas por internet. */}
      <Section muted className="overflow-hidden">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5 lg:order-2">
            <SectionTitle
              align="left"
              eyebrow="Agenda y servicios"
              title="¿Atiendes con hora? Tus clientes reservan solos"
              description="Para peluquerías, barberías, estética, consultas, clases y talleres. Tus servicios con precio y duración, una agenda para cada profesional y una página donde tus clientes eligen su hora."
            />
            <ul className="space-y-2 text-[15px]">
              {["Agenda del día por profesional, sin choques de hora","Reservas por internet según tu horario de atención","Recordatorio por WhatsApp a cada cliente","Cobras la cita con un toque, con la comisión de quien atendió"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="h-11" asChild>
                <SignupLink inApp="/dashboard/servicios" loggedInLabel="Ir a mis servicios">Crear mi agenda</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-11" asChild>
                <Link href="/funciones#agenda">Ver cómo funciona</Link>
              </Button>
            </div>
          </div>
          <AgendaPreview className="lg:order-1" />
        </div>
      </Section>

      {/* Cotizaciones con enlace para aceptarlas. */}
      <Section className="overflow-hidden">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <SectionTitle
              align="left"
              eyebrow="Cotizaciones"
              title="¿Haces presupuestos? Envíalos por WhatsApp y que te digan que sí"
              description="Arma la cotización con tus productos y precios en un minuto. Tu cliente la abre en un enlace con tu logo y tu RUT, la descarga en PDF y la acepta con un botón."
            />
            <ul className="space-y-2 text-[15px]">
              {["IVA desglosado, descuento, validez y tus condiciones","Sabes si el cliente ya la abrió y te avisamos cuando la acepta","La vendes con un toque y se descuenta el stock","Para ferreterías, talleres, eventos, servicios y más (plan Pro)"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="h-11" asChild>
                <SignupLink inApp="/dashboard/cotizaciones" loggedInLabel="Hacer una cotización">Crear mi cuenta gratis</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-11" asChild>
                <Link href="/funciones#cotizaciones">Ver cómo funciona</Link>
              </Button>
            </div>
          </div>
          <QuotePreview />
        </div>
      </Section>

      {/* Recetas: costo real de lo que se elabora. */}
      <Section muted className="overflow-hidden">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5 lg:order-2">
            <SectionTitle
              align="left"
              eyebrow="Recetas"
              title="¿Cocinas o fabricas lo que vendes? Calcula su costo real"
              description="Para panaderías, pastelerías, comida, jabones, velas y cosmética. Anota tus ingredientes con su precio y te decimos cuánto te cuesta cada unidad y a cuánto venderla."
            />
            <ul className="space-y-2 text-[15px]">
              {["Ingredientes con su precio en kilos, gramos, litros o unidades","Costo por unidad y precio sugerido según el margen que quieres","Stock de tus materiales y aviso antes de que venzan","Al vender, los materiales se descuentan solos","Gratis en todos los planes"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="h-11" asChild>
                <SignupLink inApp="/dashboard/recetas" loggedInLabel="Ir a mis recetas">Crear mi cuenta gratis</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-11" asChild>
                <Link href="/funciones#recetas">Ver cómo funciona</Link>
              </Button>
            </div>
          </div>
          <RecipesPreview className="lg:order-1" />
        </div>
      </Section>

      {/* Etiquetas con código de barras para lo que no trae código. */}
      <Section className="overflow-hidden">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <SectionTitle
              align="left"
              eyebrow="Etiquetas"
              title="¿Tu producto no trae código? Imprímele uno"
              description="Pan, quesos, verduras, ropa o lo que haces tú: imprime etiquetas con nombre, precio y código de barras, y véndelos escaneando como cualquier otro producto."
            />
            <ul className="space-y-2 text-[15px]">
              {["En hojas de stickers A4 con tu impresora de siempre, o en una impresora de etiquetas","Te creamos el código si no tiene, sin repetir ninguno","Lo lee la cámara del celular o cualquier lector de caja","Gratis en todos los planes"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="h-11" asChild>
                <SignupLink inApp="/dashboard/productos/etiquetas" loggedInLabel="Imprimir mis etiquetas">Crear mi cuenta gratis</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-11" asChild>
                <Link href="/funciones#productos">Ver cómo funciona</Link>
              </Button>
            </div>
          </div>
          <LabelsPreview />
        </div>
      </Section>

      {/* Promociones y cupones que se aplican solos. */}
      <Section muted className="overflow-hidden">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5 lg:order-2">
            <SectionTitle
              align="left"
              eyebrow="Promociones"
              title="¿Haces ofertas? Crea un 2×1 y se aplica solo"
              description="2×1, descuentos por categoría, happy hour y cupones. Se aplican solos al vender, en las comandas y en tu tienda online: tu equipo no tiene que acordarse de nada."
            />
            <ul className="space-y-2 text-[15px]">
              {["2×1, 3×2 o % de descuento en los productos o categorías que elijas","Happy hour: solo ciertos días y horas","Cupones para tu tienda online, con límite de usos y vencimiento","Compártela por WhatsApp con un toque y mira en Reportes cuánto te rindió"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="h-11" asChild>
                <SignupLink inApp="/dashboard/promociones" loggedInLabel="Crear mi promoción">Crear mi cuenta gratis</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-11" asChild>
                <Link href="/funciones#promociones">Ver cómo funciona</Link>
              </Button>
            </div>
          </div>
          <PromosPreview className="lg:order-1" />
        </div>
      </Section>

      {/* Tarjeta de fidelidad: sellos o puntos en el celular del cliente. */}
      <Section className="overflow-hidden">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <SectionTitle
              align="left"
              eyebrow="Tarjeta de fidelidad"
              title="¿Quieres que vuelvan? Dales una tarjeta de sellos en su celular"
              description="Como la tarjeta de cartón de la cafetería, pero en el celular de tu cliente: no se pierde, no se olvida en la casa y se llena sola cada vez que le vendes."
            />
            <ul className="space-y-2 text-[15px]">
              {["Sellos (10 compras y un premio) o puntos según lo que compran: tú eliges","Le envías la tarjeta por WhatsApp y la guarda en su celular, como una app","Se suma sola cada vez que le vendes, también en comandas y pedidos web","Escaneas su código, canjeas el premio con un toque y ves quién está por ganarlo"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="h-11" asChild>
                <SignupLink inApp="/dashboard/fidelidad" loggedInLabel="Crear mi tarjeta">Crear mi cuenta gratis</SignupLink>
              </Button>
              <Button size="lg" variant="outline" className="h-11" asChild>
                <Link href="/funciones#fidelidad">Ver cómo funciona</Link>
              </Button>
            </div>
          </div>
          <LoyaltyPreview />
        </div>
      </Section>

      <Section>
        <SectionTitle eyebrow="Precios" title="Empieza gratis. Crece cuando lo necesites." />
        <div className="mt-12">
          <PricingCards compact />
        </div>
        <MoreLink href="/precios">Comparar planes</MoreLink>
      </Section>

      <Section muted>
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
          <div className="space-y-4">
            <SectionTitle
              align="left"
              title="¿Tienes dudas?"
              description="Lo que más nos preguntan los dueños de negocio antes de empezar."
            />
            <Link href="/preguntas-frecuentes" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Ver todas las preguntas
            </Link>
          </div>
          <FaqList items={TOP_FAQ} />
        </div>
      </Section>

      <SocialSection />

      <CtaSection users={users} />
    </>
  )
}
