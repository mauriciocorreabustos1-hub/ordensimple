import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { cache } from "react"
import { BusinessLogo } from "@/components/app/business-logo"
import { StoreFront } from "@/components/store/store-front"
import { db } from "@/lib/db"
import { canUseFeature, effectivePlan } from "@/lib/plans"
import { STORE_SLUG_RE } from "@/lib/store"
import { toDateKey } from "@/lib/dates"
import { BookingFlow } from "@/components/store/booking-flow"
import { StoreTabs } from "@/components/store/store-tabs"
import { bookableDays, bookableServices, bookableStaff, getBookableBusiness } from "@/server/booking"

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
    },
  })
  if (!b || !b.storeEnabled || !b.storeWhatsapp || !canUseFeature(effectivePlan(b), "store")) return null
  return b
})

export async function generateMetadata({ params }: PageProps<"/tienda/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store) return { title: "Tienda no encontrada", robots: { index: false } }
  const booking = await getBookableBusiness(slug)
  const description = store.storeMessage || (booking ? `Reserva tu hora en ${store.name} en un minuto.` : `Mira los productos de ${store.name} y haz tu pedido por WhatsApp.`)
  return {
    title: { absolute: `${store.name} · ${booking ? "Reserva tu hora" : "Pedidos por WhatsApp"}` },
    description,
    openGraph: { title: store.name, description },
  }
}

export default async function StorePage({ params }: PageProps<"/tienda/[slug]">) {
  const { slug } = await params
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
    select: { id: true, name: true, price: true, stock: true, trackStock: true, imageUrl: true, category: { select: { name: true } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    take: 500,
  })

  const canBook = Boolean(booking && services.length)
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
  const storeFront = (
    <StoreFront
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
      }))}
    />
  )

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <BusinessLogo businessId={store.id} name={store.name} logoUpdatedAt={store.logoUpdatedAt} className="size-12 rounded-xl border" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{store.name}</h1>
            <p className="text-sm text-muted-foreground">
              {store.storeMessage || (booking ? "Reserva tu hora en un minuto." : "Elige tus productos y envía tu pedido por WhatsApp.")}
            </p>
          </div>
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
