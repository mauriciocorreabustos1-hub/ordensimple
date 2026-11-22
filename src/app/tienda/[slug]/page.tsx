import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { cache } from "react"
import { BusinessLogo } from "@/components/app/business-logo"
import { StoreFront } from "@/components/store/store-front"
import { db } from "@/lib/db"
import { formatMoney } from "@/lib/currency"
import { canUseFeature, effectivePlan } from "@/lib/plans"
import { STORE_SLUG_RE } from "@/lib/store"
import { activePromotions } from "@/server/sale-core"
import { toDateKey } from "@/lib/dates"
import { BookingFlow } from "@/components/store/booking-flow"
import { StoreTabs } from "@/components/store/store-tabs"
import { bookableDays, bookableServices, bookableStaff, getBookableBusiness } from "@/server/booking"
import { storeTables } from "@/server/store-tables"
import { storePayRule } from "@/server/mp-marketplace"

/** Tienda publicada y con plan vigente; si no, la página no existe. */
const getStore = cache(async (slug: string) => {
  if (!STORE_SLUG_RE.test(slug)) return null
  const b = await db.business.findUnique({
    where: { storeSlug: slug },
    select: {
      id: true,
      name: true,
      currency: true,
      plan: true,
      planExpiresAt: true,
      storeEnabled: true,
      storeWhatsapp: true,
      storeMessage: true,
      logoUpdatedAt: true,
      timezone: true,
    },
  })
  if (!b || !b.storeEnabled || !b.storeWhatsapp || !canUseFeature(effectivePlan(b), "store")) return null
  return b
})

/** El producto de un enlace directo (?p=…), si está a la venta en esa tienda. */
async function sharedProduct(storeId: string, id: unknown) {
  if (typeof id !== "string" || !/^[\w-]{8,40}$/.test(id)) return null
  return db.product.findFirst({
    where: { id, businessId: storeId, active: true, isService: false, price: { gt: 0 } },
    select: { id: true, name: true, price: true, description: true, imageUrl: true },
  })
}

export async function generateMetadata({ params, searchParams }: PageProps<"/tienda/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store) return { title: "Tienda no encontrada", robots: { index: false } }
  // Enlace directo a un producto: al compartirlo en WhatsApp o redes se ve con su foto, nombre y precio.
  const product = await sharedProduct(store.id, (await searchParams).p)
  if (product) {
    const price = formatMoney(product.price, store.currency)
    const text = product.description ? `${price} · ${product.description.replace(/\s+/g, " ").slice(0, 150)}` : `${price} en ${store.name}. Haz tu pedido por WhatsApp.`
    return {
      title: { absolute: `${product.name} · ${store.name}` },
      description: text,
      alternates: { canonical: `/tienda/${slug}?p=${product.id}` },
      openGraph: {
        title: `${product.name} · ${price}`,
        description: text,
        siteName: store.name,
        url: `/tienda/${slug}?p=${product.id}`,
        ...(product.imageUrl ? { images: [{ url: product.imageUrl, alt: product.name }] } : {}),
      },
      twitter: { card: "summary", title: `${product.name} · ${price}`, description: text, ...(product.imageUrl ? { images: [product.imageUrl] } : {}) },
    }
  }
  const bookable = await getBookableBusiness(slug)
  const booking = bookable ? (await bookableServices(bookable.id)).length > 0 : false
  const description = store.storeMessage || (booking ? `Reserva tu hora en ${store.name} en un minuto.` : `Mira los productos de ${store.name} y haz tu pedido por WhatsApp.`)
  return {
    title: { absolute: `${store.name} · ${booking ? "Reserva tu hora" : "Pedidos por WhatsApp"}` },
    description,
    openGraph: { title: store.name, description },
  }
}

export default async function StorePage({ params, searchParams }: PageProps<"/tienda/[slug]">) {
  const { slug } = await params
  const { mesa, p: openProduct } = await searchParams
  const store = await getStore(slug)
  if (!store) {
    // Si el negocio cambió la dirección de su tienda, los enlaces viejos llevan a la nueva.
    const moved = STORE_SLUG_RE.test(slug)
      ? await db.business.findFirst({ where: { storeOldSlugs: { has: slug }, storeSlug: { not: null } }, select: { storeSlug: true } })
      : null
    if (moved?.storeSlug) permanentRedirect(`/tienda/${moved.storeSlug}`)
    notFound()
  }
  // Negocios de servicios: arriba se reserva hora; los servicios con duración no van al carro de compras.
  const booking = await getBookableBusiness(slug)
  const [services, staff] = booking ? await Promise.all([bookableServices(booking.id), bookableStaff(booking.id)]) : [[], []]
  const products = await db.product.findMany({
    where: {
      businessId: store.id,
      active: true,
      price: { gt: 0 },
      OR: [{ trackStock: false }, { stock: { gt: 0 } }],
      // Los servicios se reservan arriba, no van al carro.
      isService: false,
    },
    select: { id: true, name: true, description: true, uses: true, benefits: true, price: true, stock: true, trackStock: true, imageUrl: true, categoryId: true, category: { select: { name: true } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    take: 500,
  })

  // Promociones de la tienda (2×1, %) y si hay cupones activos para mostrar el campo.
  const plan = effectivePlan(store)
  const [promotions, hasCoupons] = await Promise.all([
    activePromotions(store.id, plan),
    canUseFeature(plan, "promos") ? db.storeCoupon.count({ where: { businessId: store.id, active: true } }).then((n) => n > 0) : Promise.resolve(false),
  ])
  const canBook = Boolean(booking && services.length)
  const payRule = await storePayRule(store.id)
  const bookingFlow = canBook ? (
    <BookingFlow
      slug={slug}
      businessName={store.name}
      currency={store.currency}
      services={services.map((s) => ({ id: s.id, name: s.name, price: s.price, durationMin: s.durationMin! }))}
      staff={staff.map((p) => ({ id: p.id, name: p.name.split(" ")[0] }))}
      days={bookableDays(booking!)}
      today={toDateKey(new Date(), booking!.timezone)}
    />
  ) : null
  // Abierta desde el QR de una mesa: solo si es una mesa del local.
  const table = typeof mesa === "string" && (await storeTables(store.id)).includes(mesa) ? mesa : null
  const storeFront = (
    <StoreFront
      openProductId={typeof openProduct === "string" ? openProduct : null}
      table={table}
      payRule={payRule}
      promotions={promotions.filter((p) => p.online)}
      timezone={store.timezone}
      coupons={hasCoupons}
      slug={slug}
      businessName={store.name}
      currency={store.currency}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category?.name ?? null,
        max: p.trackStock ? Math.min(99, p.stock) : 99,
        imageUrl: p.imageUrl,
        categoryId: p.categoryId,
        description: p.description,
        uses: p.uses,
        benefits: p.benefits,
      }))}
    />
  )

  return (
    <div className="min-h-dvh bg-muted dark:bg-background">
      <header className="mx-auto max-w-3xl space-y-4 px-4 pt-5">
        <div className="flex items-center gap-3">
          <BusinessLogo businessId={store.id} name={store.name} logoUpdatedAt={store.logoUpdatedAt} className="size-14 rounded-2xl border" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{store.name}</h1>
            <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <span aria-hidden className="size-2 rounded-full bg-primary" />
              {table ? `Pedido para ${table}` : canBook && !products.length ? "Reservas en línea" : "Despacho y retiro en el local"}
            </p>
          </div>
        </div>
        {/* Franja de bienvenida: el mensaje del negocio, o qué se hace en esta página. */}
        <div className="rounded-3xl bg-[oklch(0.24_0.04_165)] px-6 py-5 text-white">
          <p className="text-2xl leading-tight font-bold text-balance">
            {table ? "Pide desde tu mesa" : canBook && !products.length ? "Reserva tu hora" : "Pide desde tu casa"}
          </p>
          <p className="mt-1 font-medium text-pretty text-[oklch(0.8_0.15_160)]">
            {store.storeMessage || (canBook && !products.length ? "Elige el servicio y la hora en un minuto." : "Te confirmamos por WhatsApp.")}
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-4 pb-36">
        {canBook && products.length ? <StoreTabs booking={bookingFlow} products={storeFront} /> : canBook ? bookingFlow : storeFront}
      </main>
      <footer className="pb-28 text-center text-xs text-muted-foreground">
        Tienda hecha con{" "}
        <Link href="/?utm_source=tienda" className="font-medium text-primary hover:underline">
          OrdenSimple
        </Link>
      </footer>
    </div>
  )
}
