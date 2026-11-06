import type { Metadata } from "next"
import { SetupGuide, type GuideFeature } from "@/components/onboarding/setup-guide"
import type { DemoItem } from "@/components/onboarding/sale-demo"
import { db } from "@/lib/db"
import { businessProfile } from "@/lib/business-kind"
import { referenceAmount } from "@/lib/currency"
import { canUseFeature, type PlanFeature } from "@/lib/plans"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "Primeros pasos" }

type Feature = GuideFeature & { feature?: PlanFeature }

/** Ejemplos según el rubro. Los montos están en pesos chilenos y se adaptan a la moneda del negocio. */
function byRubro(type: string) {
  const t = type.toLowerCase()
  if (/restaur|caf[eé]|comida/.test(t))
    return {
      demo: [["Café", 2500], ["Sándwich", 4900], ["Jugo natural", 2800]],
      features: [
        { title: "Comandas por mesa", text: "Toma el pedido y mándalo a la cocina.", href: "/dashboard/comandas", feature: "comandas" },
        { title: "Recetas", text: "Cuánto te cuesta cada plato.", href: "/dashboard/recetas" },
        { title: "Carta con QR", text: "Tus clientes ven la carta y piden.", href: "/dashboard/comandas/carta-qr", feature: "store" },
      ],
    }
  if (/belleza|est[eé]tic|peluquer|barber/.test(t))
    return {
      demo: [["Corte de pelo", 10000], ["Barba", 6000], ["Lavado", 4000]],
      features: [
        { title: "Agenda de horas", text: "Tus clientes reservan solos.", href: "/dashboard/agenda", feature: "agenda" },
        { title: "Servicios", text: "Precio y duración de cada uno.", href: "/dashboard/servicios" },
        { title: "Clientes", text: "Quién viene y cuánto te compra.", href: "/dashboard/clientes", feature: "customers" },
      ],
    }
  if (/ferreter|construcci/.test(t))
    return {
      demo: [["Caja de tornillos", 3990], ["Cinta aisladora", 1490], ["Martillo", 8990]],
      features: [
        { title: "Códigos de barras", text: "Vende escaneando con la cámara.", href: "/dashboard/productos" },
        { title: "Stock", text: "Cuánto te queda y qué reponer.", href: "/dashboard/inventario", feature: "inventory" },
        { title: "Cotizaciones", text: "Envía un presupuesto con enlace.", href: "/dashboard/cotizaciones", feature: "quotes" },
      ],
    }
  if (/ropa|accesorio/.test(t))
    return {
      demo: [["Polera", 9990], ["Jeans", 24990], ["Calcetines", 2990]],
      features: [
        { title: "Inventario", text: "Lo que tienes de cada prenda.", href: "/dashboard/inventario", feature: "inventory" },
        { title: "Promociones", text: "2×1 y descuentos que se aplican solos.", href: "/dashboard/promociones", feature: "promos" },
        { title: "Tienda online", text: "Tus clientes ven y piden por WhatsApp.", href: "/dashboard/configuracion?seccion=tienda", feature: "store" },
      ],
    }
  if (/servicios profesionales|asesor|consult/.test(t))
    return {
      demo: [["Asesoría (1 hora)", 30000], ["Visita técnica", 25000], ["Informe", 15000]],
      features: [
        { title: "Clientes", text: "Cada cliente con lo que te debe.", href: "/dashboard/clientes", feature: "customers" },
        { title: "Cotizaciones", text: "Envía un presupuesto con enlace.", href: "/dashboard/cotizaciones", feature: "quotes" },
        { title: "Servicios", text: "Precio de cada uno.", href: "/dashboard/servicios" },
      ],
    }
  return {
    demo: [["Pan amasado", 1500], ["Leche 1 L", 1190], ["Bebida 1,5 L", 1990]],
    features: [
      { title: "Inventario", text: "Lo que te queda y qué reponer.", href: "/dashboard/inventario", feature: "inventory" },
      { title: "Fiado", text: "Quién te debe y cobro por WhatsApp.", href: "/dashboard/clientes", feature: "customers" },
      { title: "Reportes", text: "Cómo te fue este mes.", href: "/dashboard/reportes", feature: "reports" },
    ],
  }
}

export default async function FirstStepsPage() {
  const ctx = await requireBusiness()
  // Agregar productos es del dueño o un administrador; un trabajador va directo a su Inicio.
  requirePermission(ctx, "products:manage")
  const type = ctx.business.type ?? ""
  const profile = businessProfile(type)
  const [products, services, categories] = await Promise.all([
    db.product.findMany({ where: { businessId: ctx.businessId, isService: false }, select: { name: true }, orderBy: { createdAt: "desc" }, take: 4 }),
    profile.services
      ? db.product.findMany({ where: { businessId: ctx.businessId, isService: true }, select: { name: true }, orderBy: { createdAt: "desc" }, take: 4 })
      : Promise.resolve(null),
    db.category.findMany({ where: { businessId: ctx.businessId, products: { some: { isService: false } } }, select: { name: true }, orderBy: { name: "asc" } }),
  ])
  const [productCount, serviceCount] = await Promise.all([
    db.product.count({ where: { businessId: ctx.businessId, isService: false } }),
    services ? db.product.count({ where: { businessId: ctx.businessId, isService: true } }) : Promise.resolve(0),
  ])

  const rubro = byRubro(type)
  const scale = referenceAmount(ctx.currency) / referenceAmount("CLP")
  const demoItems: DemoItem[] = rubro.demo.map(([name, clp]) => ({ name: name as string, price: Math.round((clp as number) * scale) }))
  // Solo lo que el plan del negocio permite usar.
  const features = (rubro.features as Feature[])
    .filter((f) => !f.feature || canUseFeature(ctx.business.plan, f.feature))
    .map(({ title, text, href }) => ({ title, text, href }))

  const sellsProducts = !profile.servicesOnly
  const noun = profile.food
    ? { plural: "platos y productos", first: "lo que más vendes, por ejemplo tu plato o bebida estrella" }
    : profile.servicesOnly
      ? { plural: "servicios", first: "tu servicio más pedido" }
      : { plural: "productos", first: "los 3 o 4 productos que más vendes" }

  return (
    <SetupGuide
      businessId={ctx.businessId}
      businessName={ctx.business.name}
      currency={ctx.currency}
      noun={noun}
      products={{ count: productCount, recent: products.map((p) => p.name) }}
      services={services ? { count: serviceCount, recent: services.map((p) => p.name) } : null}
      sellsProducts={sellsProducts}
      categories={categories.map((c) => c.name)}
      demoItems={demoItems}
      features={features}
    />
  )
}
