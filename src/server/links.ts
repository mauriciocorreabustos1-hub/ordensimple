import "server-only"
import { cache } from "react"
import type { Plan } from "@/generated/prisma/enums"
import type { LinkProductCard, LinkViewData } from "@/components/links/link-page-view"
import { getAppUrl } from "@/lib/app-url"
import { normalizePhone } from "@/lib/contact-card"
import { formatMoney } from "@/lib/currency"
import { toDateKey } from "@/lib/dates"
import { db } from "@/lib/db"
import { isValidLinkSlug, linkPath, readContent, toFreeContent, type LinkContent } from "@/lib/links"
import { canUseFeature, effectivePlan } from "@/lib/plans"
import { storePath } from "@/lib/store"
import { bookableServices, getBookableBusiness } from "@/server/booking"
import { whatsappLink } from "@/lib/whatsapp"

/**
 * Dirección pública de la página. Con LINKS_HOST (por ejemplo links.ordensimple.cl, ya agregado como dominio en
 * Vercel) queda corta; si no, va en el dominio principal. Las dos funcionan siempre.
 */
export function linkPublicUrl(slug: string) {
  const host = process.env.LINKS_HOST?.trim()
  return host ? `https://${host}/${slug}` : `${getAppUrl()}${linkPath(slug)}`
}

/** Dirección para el código QR: siempre la del dominio principal, que no depende de ninguna configuración extra. */
export const linkQrUrl = (slug: string) => `${getAppUrl()}${linkPath(slug)}?src=qr`

/** Lo del negocio que necesita la página: plan, tienda, WhatsApp, logo y zona horaria. */
export const LINK_BUSINESS_SELECT = {
  id: true,
  name: true,
  plan: true,
  planExpiresAt: true,
  currency: true,
  timezone: true,
  storeEnabled: true,
  storeSlug: true,
  storeWhatsapp: true,
  logoUpdatedAt: true,
} as const

export type LinkBusiness = { id: string; name: string; plan: Plan; planExpiresAt: Date | null; currency: string; timezone: string; storeEnabled: boolean; storeSlug: string | null; storeWhatsapp: string | null; logoUpdatedAt: Date | null }

export function linksPro(b: { plan: Plan; planExpiresAt: Date | null }) {
  return canUseFeature(effectivePlan(b), "linksPro")
}

/** Tienda online publicada y con plan vigente (para enlazar los productos a su ficha). */
function storeOpen(b: LinkBusiness) {
  return Boolean(b.storeEnabled && b.storeSlug && b.storeWhatsapp && canUseFeature(effectivePlan(b), "store"))
}

/** Dónde se reserva hora, o null si el negocio no recibe reservas en línea. */
export async function bookingUrlFor(b: LinkBusiness) {
  if (!b.storeSlug) return null
  const bookable = await getBookableBusiness(b.storeSlug)
  if (!bookable || !(await bookableServices(bookable.id)).length) return null
  return `${getAppUrl()}${storePath(b.storeSlug)}`
}

/**
 * Productos de los bloques "Productos", leídos en vivo del catálogo del mismo negocio: si cambia el precio o la
 * foto, la página lo muestra al tiro. Solo sale lo público (nombre, foto y precio); nunca el costo ni el stock.
 */
export async function productsFor(b: LinkBusiness, content: LinkContent): Promise<Record<string, LinkProductCard[]>> {
  const blocks = content.blocks.filter((x) => x.type === "products")
  const ids = [...new Set(blocks.flatMap((x) => (x.type === "products" ? x.productIds : [])))]
  if (!ids.length) return {}
  const rows = await db.product.findMany({
    where: { id: { in: ids }, businessId: b.id, active: true, price: { gt: 0 } },
    select: { id: true, name: true, price: true, imageUrl: true, isService: true, trackStock: true, stock: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const store = storeOpen(b)
  const origin = getAppUrl()
  const whatsapp = normalizePhone(b.storeWhatsapp ?? content.profile.phone ?? "")
  const out: Record<string, LinkProductCard[]> = {}
  for (const block of blocks) {
    if (block.type !== "products") continue
    out[block.id] = block.productIds.flatMap((id) => {
      const p = byId.get(id)
      if (!p) return []
      const inStock = !p.trackStock || p.stock > 0
      const href =
        store && !p.isService && inStock
          ? `${origin}${storePath(b.storeSlug!)}?p=${p.id}`
          : store && p.isService
            ? `${origin}${storePath(b.storeSlug!)}`
            : whatsapp
              ? whatsappLink(whatsapp, `Hola, me interesa: ${p.name}`)
              : null
      return [{ id: p.id, name: p.name, price: formatMoney(p.price, b.currency), imageUrl: p.imageUrl, href }]
    })
  }
  return out
}

export const logoUrlFor = (b: { id: string; logoUpdatedAt: Date | null }) => (b.logoUpdatedAt ? `/logo/${b.id}?v=${b.logoUpdatedAt.getTime()}` : null)

/** Todo lo que necesita la vista para dibujar un contenido de este negocio. */
export async function viewDataFor(b: LinkBusiness, content: LinkContent, preview = false): Promise<LinkViewData> {
  const [products, bookingUrl] = await Promise.all([productsFor(b, content), content.blocks.some((x) => x.type === "booking") ? bookingUrlFor(b) : null])
  return { content, logoUrl: logoUrlFor(b), products, bookingUrl, today: toDateKey(new Date(), b.timezone), preview }
}

/** Página publicada, lista para mostrar (con lo Pro apagado si el plan ya no lo incluye), o null. */
export const getPublicLinkPage = cache(async (slug: string) => {
  if (!isValidLinkSlug(slug)) return null
  const page = await db.linkPage.findUnique({ where: { slug }, select: { id: true, slug: true, published: true, live: true, business: { select: LINK_BUSINESS_SELECT } } })
  if (!page?.published || !page.live) return null
  const stored = readContent(page.live)
  if (!stored) return null
  const content = linksPro(page.business) ? stored : toFreeContent(stored)
  return { id: page.id, slug: page.slug, business: page.business, data: await viewDataFor(page.business, content) }
})

/** Si el nombre fue de otra página que se renombró, el nombre nuevo (para redirigir los enlaces y QR viejos). */
export async function movedLinkSlug(slug: string) {
  if (!isValidLinkSlug(slug)) return null
  const page = await db.linkPage.findFirst({ where: { oldSlugs: { has: slug } }, select: { slug: true } })
  return page?.slug ?? null
}
