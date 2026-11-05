"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { BUSINESS_TYPE_EVENT, BUSINESS_TYPES, type BusinessTypeId } from "@/components/landing/business-types"
import { smoothScrollTo } from "@/components/landing/smooth-scroll"
import { SignupLink } from "@/components/landing/signup-link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const AgendaPreview = dynamic(() => import("@/components/landing/agenda-preview").then((m) => m.AgendaPreview))
const ComandasPreview = dynamic(() => import("@/components/landing/comandas-preview").then((m) => m.ComandasPreview))
const LabelsPreview = dynamic(() => import("@/components/landing/labels-preview").then((m) => m.LabelsPreview))
const LoyaltyPreview = dynamic(() => import("@/components/landing/loyalty-preview").then((m) => m.LoyaltyPreview))
const PaymentsPreview = dynamic(() => import("@/components/landing/payments-preview").then((m) => m.PaymentsPreview))
const PromosPreview = dynamic(() => import("@/components/landing/promos-preview").then((m) => m.PromosPreview))
const QuotePreview = dynamic(() => import("@/components/landing/quote-preview").then((m) => m.QuotePreview))
const RecipesPreview = dynamic(() => import("@/components/landing/recipes-preview").then((m) => m.RecipesPreview))
const StorePreview = dynamic(() => import("@/components/landing/store-preview").then((m) => m.StorePreview))
const TrackingPreview = dynamic(() => import("@/components/landing/tracking-preview").then((m) => m.TrackingPreview))

type Feature = {
  title: string
  text: string
  points: string[]
  more: string
  inApp: string
  inAppLabel: string
  Preview: React.ComponentType<{ className?: string }>
}

const FEATURES = {
  etiquetas: {
    title: "¿Tu producto no trae código? Imprímele uno",
    text: "Pan, quesos, verduras, ropa o lo que haces tú: imprime etiquetas con nombre, precio y código de barras, y véndelos escaneando como cualquier otro producto.",
    points: ["En hojas de stickers A4 con tu impresora de siempre, o en una impresora de etiquetas", "Te creamos el código si no tiene, sin repetir ninguno", "Lo lee la cámara del celular o cualquier lector de caja", "Gratis en todos los planes"],
    more: "/funciones#productos",
    inApp: "/dashboard/productos/etiquetas",
    inAppLabel: "Imprimir mis etiquetas",
    Preview: LabelsPreview,
  },
  promos: {
    title: "¿Haces ofertas? Crea un 2×1 y se aplica solo",
    text: "2×1, descuentos por categoría, happy hour y cupones. Se aplican solos al vender, en las comandas y en tu tienda online: tu equipo no tiene que acordarse de nada.",
    points: ["2×1, 3×2 o % de descuento en los productos o categorías que elijas", "Happy hour: solo ciertos días y horas", "Cupones para tu tienda online, con límite de usos y vencimiento", "Compártela por WhatsApp con un toque y mira en Reportes cuánto te rindió"],
    more: "/funciones#promociones",
    inApp: "/dashboard/promociones",
    inAppLabel: "Crear mi promoción",
    Preview: PromosPreview,
  },
  fidelidad: {
    title: "¿Quieres que vuelvan? Dales una tarjeta de sellos en su celular",
    text: "Como la tarjeta de cartón de la cafetería, pero en el celular de tu cliente: no se pierde, no se olvida en la casa y se llena sola cada vez que le vendes.",
    points: ["Sellos (10 compras y un premio) o puntos según lo que compran: tú eliges", "Le envías la tarjeta por WhatsApp y la guarda en su celular, como una app", "Se suma sola cada vez que le vendes, también en comandas y pedidos web", "Escaneas su código, canjeas el premio con un toque y ves quién está por ganarlo"],
    more: "/funciones#fidelidad",
    inApp: "/dashboard/fidelidad",
    inAppLabel: "Crear mi tarjeta",
    Preview: LoyaltyPreview,
  },
  cobros: {
    title: "Que te paguen con tarjeta, aunque no tengas máquina",
    text: "Conecta tu cuenta de Mercado Pago y cobra desde tu tienda, tus cotizaciones o un enlace por WhatsApp. El pago queda registrado solo en OrdenSimple.",
    points: ["Tarjeta de crédito, débito o saldo de Mercado Pago", "En tu tienda online, en tus cotizaciones o con un enlace que mandas por WhatsApp", "Tú decides si los pedidos se pagan online, solo los despachos o al retirar", "El dinero llega directo a tu cuenta de Mercado Pago y te avisamos de cada pago", "Sin costo fijo: Mercado Pago cobra su comisión y OrdenSimple un 1 % por pago"],
    more: "/funciones#cobros",
    inApp: "/dashboard/cobros",
    inAppLabel: "Conectar Mercado Pago",
    Preview: PaymentsPreview,
  },
  comandas: {
    title: "Anota por mesa y manda los platos a la cocina",
    text: "Anota las comandas por mesa desde el celular, mándalas a la pantalla de la cocina y cobra al final. Todo queda como venta.",
    points: ["Tus mesas, las que quieras, y ves cuáles están ocupadas", "La cocina marca cada plato listo y el garzón lo ve de inmediato", "Carta con QR en cada mesa: piden desde su celular", "La cuenta separada por persona, impresa en tu impresora de boletas", "Sin comprar nada: celular, tablet o computador"],
    more: "/restaurantes",
    inApp: "/dashboard/comandas",
    inAppLabel: "Ir a mis comandas",
    Preview: ComandasPreview,
  },
  recetas: {
    title: "¿Cocinas o fabricas lo que vendes? Calcula su costo real",
    text: "Para panaderías, pastelerías, comida, jabones, velas y cosmética. Anota tus ingredientes con su precio y te decimos cuánto te cuesta cada unidad y a cuánto venderla.",
    points: ["Ingredientes con su precio en kilos, gramos, litros o unidades", "Costo por unidad y precio sugerido según el margen que quieres", "Stock de tus materiales y aviso antes de que venzan", "Al vender, los materiales se descuentan solos", "Gratis en todos los planes"],
    more: "/funciones#recetas",
    inApp: "/dashboard/recetas",
    inAppLabel: "Ir a mis recetas",
    Preview: RecipesPreview,
  },
  agenda: {
    title: "¿Atiendes con hora? Tus clientes reservan solos",
    text: "Para peluquerías, barberías, estética, consultas, clases y talleres. Tus servicios con precio y duración, una agenda para cada profesional y una página donde tus clientes eligen su hora.",
    points: ["Agenda del día por profesional, sin choques de hora", "Reservas por internet según tu horario de atención", "Recordatorio por WhatsApp a cada cliente", "Cobras la cita con un toque, con la comisión de quien atendió"],
    more: "/funciones#agenda",
    inApp: "/dashboard/servicios",
    inAppLabel: "Ir a mis servicios",
    Preview: AgendaPreview,
  },
  tienda: {
    title: "¿Vendes por WhatsApp? Ten tu propia página web",
    text: "Tus productos con foto, precio y stock en una página con tu nombre. Tus clientes arman el pedido y te llega por WhatsApp, ordenado y listo para despachar, sin comisión. Si quieres, que te lo paguen con tarjeta al pedir.",
    points: ["Tu dirección: ordensimple.cl/tienda/tu-negocio", "Retiro en el local o despacho, con la dirección del cliente", "Con un toque el pedido queda como venta y se descuenta el stock", "Te avisa al celular apenas entra un pedido"],
    more: "/funciones#tienda",
    inApp: "/dashboard/configuracion?seccion=tienda",
    inAppLabel: "Ir a mi tienda",
    Preview: StorePreview,
  },
  seguimiento: {
    title: "¿Te preguntan “¿y mi pedido?”? Que lo vean solos",
    text: "Cada pedido de tu tienda online trae un enlace donde tu cliente ve en qué va: recibido, en preparación, listo o en camino, y entregado. Tú lo avanzas con un toque.",
    points: ["El enlace le llega en su propio mensaje de WhatsApp", "La página se actualiza sola, sin descargar nada", "Le avisas cada cambio por WhatsApp con el mensaje ya escrito", "Incluido en el plan Pro, con tu tienda online"],
    more: "/funciones#tienda",
    inApp: "/dashboard/pedidos",
    inAppLabel: "Ver mis pedidos",
    Preview: TrackingPreview,
  },
  cotizaciones: {
    title: "¿Haces presupuestos? Envíalos por WhatsApp y que te digan que sí",
    text: "Arma la cotización con tus productos y precios en un minuto. Tu cliente la abre en un enlace con tu logo y tu RUT, la descarga en PDF y la acepta con un botón.",
    points: ["IVA desglosado, descuento, validez y tus condiciones", "Sabes si el cliente ya la abrió y te avisamos cuando la acepta", "La vendes con un toque y se descuenta el stock", "Para ferreterías, talleres, eventos, servicios y más (plan Pro)"],
    more: "/funciones#cotizaciones",
    inApp: "/dashboard/cotizaciones",
    inAppLabel: "Hacer una cotización",
    Preview: QuotePreview,
  },
} satisfies Record<string, Feature>

type FeatureId = keyof typeof FEATURES

// Cada rubro abre con lo que más le sirve; una misma función puede estar en varios.
const FEATURES_BY_TYPE: Record<BusinessTypeId, FeatureId[]> = {
  almacen: ["etiquetas", "promos", "fidelidad", "cobros"],
  comida: ["comandas", "promos", "fidelidad", "recetas"],
  servicios: ["agenda", "fidelidad", "cobros"],
  whatsapp: ["tienda", "seguimiento", "cobros", "promos"],
  taller: ["cotizaciones", "etiquetas", "cobros"],
  propio: ["recetas", "etiquetas", "tienda"],
}
const BUSINESSES = BUSINESS_TYPES.map((b) => ({ ...b, features: FEATURES_BY_TYPE[b.id] }))

/** "¿Qué negocio tienes?": un archivador con una pestaña por rubro, y adentro solo lo que le sirve a ese negocio. */
export function BusinessFinder() {
  const root = React.useRef<HTMLElement>(null)
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([])
  const first = React.useRef(true)
  const [businessIndex, setBusinessIndex] = React.useState(0)
  const [open, setOpen] = React.useState<FeatureId>(BUSINESSES[0].features[0])

  const business = BUSINESSES[businessIndex]
  const feature: Feature = FEATURES[open]

  function choose(index: number) {
    setBusinessIndex(index)
    setOpen(BUSINESSES[index].features[0])
  }

  function onTabsKey(e: React.KeyboardEvent) {
    const last = BUSINESSES.length - 1
    const next =
      e.key === "ArrowRight" ? (businessIndex === last ? 0 : businessIndex + 1)
      : e.key === "ArrowLeft" ? (businessIndex === 0 ? last : businessIndex - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null
    if (next === null) return
    e.preventDefault()
    choose(next)
    tabs.current[next]?.focus()
    tabs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }

  // El menú "Soluciones" llega con /#rubro-<id>: abre esa pestaña y baja hasta el archivador.
  React.useEffect(() => {
    const fromHash = () => {
      const index = BUSINESSES.findIndex((b) => location.hash === `#rubro-${b.id}`)
      if (index < 0) return
      setBusinessIndex(index)
      setOpen(BUSINESSES[index].features[0])
      requestAnimationFrame(() => {
        const top = (root.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 64
        smoothScrollTo(top)
      })
    }
    fromHash()
    window.addEventListener("hashchange", fromHash)
    window.addEventListener(BUSINESS_TYPE_EVENT, fromHash)
    return () => {
      window.removeEventListener("hashchange", fromHash)
      window.removeEventListener(BUSINESS_TYPE_EVENT, fromHash)
    }
  }, [])

  // El dibujo nuevo sube y se asienta; la primera vez no, porque nadie eligió nada todavía.
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    root.current?.querySelector("[data-stage]")?.animate(
      [
        { opacity: 0, transform: "translateY(28px) scale(0.98)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 550, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    )
  }, [open])

  const Preview = feature.Preview

  return (
    <section ref={root} aria-labelledby="rubro-titulo" className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <h2 id="rubro-titulo" className="font-display text-[clamp(2.4rem,5.4vw,4.25rem)] leading-[1.02] font-semibold tracking-tight">
          ¿Qué negocio tienes?
        </h2>
        <p className="mt-3 max-w-xl text-lg text-pretty text-muted-foreground">Cada rubro trabaja distinto. Elige el tuyo y mira lo que haría OrdenSimple en tu día a día.</p>

        {/* Las pestañas del archivador: la elegida se funde con la carpeta de abajo. */}
        <div role="tablist" aria-label="Tipo de negocio" onKeyDown={onTabsKey} className="relative z-10 -mx-4 mt-10 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {BUSINESSES.map((b, i) => {
            const active = i === businessIndex
            return (
              <button
                key={b.id}
                ref={(el) => {
                  tabs.current[i] = el
                }}
                id={`rubro-${b.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="rubro-panel"
                tabIndex={active ? 0 : -1}
                onClick={() => choose(i)}
                className={cn(
                  "-mb-px min-h-11 shrink-0 rounded-t-xl border border-b-0 px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset sm:px-5 sm:text-[15px]",
                  active ? "bg-card text-foreground" : "border-transparent bg-foreground/[0.06] text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
                )}
              >
                {b.label}
              </button>
            )
          })}
        </div>

        <div id="rubro-panel" role="tabpanel" aria-labelledby={`rubro-${business.id}`} className="-mx-4 border-y bg-card sm:mx-0 sm:rounded-b-2xl sm:rounded-tr-2xl sm:border-x">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="divide-y">
              {business.features.map((id) => {
                const f: Feature = FEATURES[id]
                const isOpen = id === open
                return (
                  <div key={id}>
                    <h3>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(id)}
                        className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset sm:px-7"
                      >
                        <span className={cn("font-display text-lg leading-snug font-semibold text-balance transition-colors sm:text-xl", isOpen ? "text-foreground" : "text-muted-foreground")}>{f.title}</span>
                        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-300 motion-reduce:transition-none", isOpen && "rotate-180")} aria-hidden />
                      </button>
                    </h3>
                    <div className={cn("grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                      <div className={cn("overflow-hidden", !isOpen && "invisible")}>
                        <div className="px-5 pb-6 sm:px-7">
                          <p className="text-pretty text-muted-foreground">{f.text}</p>
                          <ul className="mt-4 space-y-2 border-l-2 border-primary/40 pl-4 text-[15px]">
                            {f.points.map((t) => (
                              <li key={t} className="text-pretty">
                                {t}
                              </li>
                            ))}
                          </ul>
                          <div className="mt-5 flex flex-wrap gap-2">
                            <Button size="lg" className="h-11" asChild>
                              <SignupLink inApp={f.inApp} loggedInLabel={f.inAppLabel}>
                                Crear mi cuenta gratis
                              </SignupLink>
                            </Button>
                            <Button size="lg" variant="outline" className="h-11" asChild>
                              <Link href={f.more}>Ver cómo funciona</Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* El dibujo: a un lado en el computador, debajo de la lista en el celular. */}
            <div className="relative flex min-h-[26rem] items-center overflow-hidden border-t bg-accent/50 p-5 sm:p-8 lg:min-h-[38rem] lg:rounded-br-2xl lg:border-t-0 lg:border-l">
              <div data-stage key={open} className="w-full">
                <Preview />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Link href="/funciones" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
            Ver todas las funciones
          </Link>
        </div>
      </div>
    </section>
  )
}
