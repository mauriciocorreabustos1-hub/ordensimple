import type { Metadata } from "next"
import { BarChart3 } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { LinkPageView } from "@/components/links/link-page-view"
import { LinkCreate } from "@/components/links/link-create"
import { LinksEditor } from "@/components/links/editor/links-editor"
import { getAppUrl } from "@/lib/app-url"
import { formatMoney } from "@/lib/currency"
import { toDateKey } from "@/lib/dates"
import { db } from "@/lib/db"
import { initialContent, linkPath, readContent, suggestSlug, templateTheme } from "@/lib/links"
import { canUseFeature, effectivePlan } from "@/lib/plans"
import { storePath } from "@/lib/store"
import { bookingUrlFor, LINK_BUSINESS_SELECT, linkPublicUrl, linksPro, logoUrlFor } from "@/server/links"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "OrdenSimple Links" }

export default async function LinksPage() {
  const ctx = await requireBusiness()
  requirePermission(ctx, "settings:manage")
  const [page, business] = await Promise.all([
    db.linkPage.findUnique({ where: { businessId: ctx.businessId }, select: { slug: true, published: true, draft: true, live: true } }),
    db.business.findUniqueOrThrow({ where: { id: ctx.businessId }, select: LINK_BUSINESS_SELECT }),
  ])
  const origin = getAppUrl()
  const publicPrefix = linkPublicUrl("")
  const storeOn = Boolean(business.storeEnabled && business.storeSlug && business.storeWhatsapp && canUseFeature(effectivePlan(business), "store"))
  const storeUrl = storeOn ? `${origin}${storePath(business.storeSlug!)}` : null
  const bookingUrl = await bookingUrlFor(business)
  const today = toDateKey(new Date(), business.timezone)

  if (!page) {
    // La muestra se arma con los datos reales del negocio: así se ve como quedaría, sin inventar nada.
    const sample = initialContent({ name: business.name, whatsapp: business.storeWhatsapp, storeUrl, canBook: Boolean(bookingUrl) })
    const shown = { ...sample, theme: templateTheme("emprendedor"), profile: { ...sample.profile, bio: "Aquí va una frase sobre tu negocio." } }
    return (
      <div className="space-y-6">
        <PageHeader title="OrdenSimple Links" description="Una página con todos tus enlaces para poner en Instagram, TikTok y WhatsApp: tu tienda, tus reservas, tu ubicación y tus redes en un solo lugar." />
        <div className="grid items-center gap-10 rounded-2xl border bg-card p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Lista en minutos", "Partimos con tu nombre, tu logo y tu WhatsApp. Tú eliges el diseño."],
                ["Conectada con tu negocio", "Muestra tus productos con el precio al día y recibe reservas de tu Agenda."],
                ["Con tu QR", "Para el mostrador o tus bolsas. Sigue sirviendo aunque cambies los enlaces."],
                ["Sabes qué funciona", "Visitas y clics reales de cada botón, sin cookies ni datos personales."],
              ].map(([title, text]) => (
                <li key={title} className="rounded-xl bg-muted/50 p-3.5">
                  <p className="font-semibold">{title}</p>
                  <p className="mt-0.5 text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
            <LinkCreate suggested={suggestSlug(business.name)} host={publicPrefix.replace(/^https?:\/\//, "")} businessName={business.name} />
          </div>
          <div aria-hidden className="mx-auto hidden w-[260px] rounded-[2rem] border border-black/10 bg-[#101513] p-2 shadow-[0_24px_50px_-28px_rgb(0_40_30/0.5)] lg:block">
            <div className="pointer-events-none h-[480px] overflow-hidden rounded-[1.6rem] bg-white">
              <div className="origin-top scale-[0.8] [width:125%] -translate-x-[10%]">
                <LinkPageView data={{ content: shown, logoUrl: logoUrlFor(business), products: {}, bookingUrl, today, preview: true }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const content = readContent(page.draft) ?? readContent(page.live) ?? initialContent({ name: business.name, whatsapp: business.storeWhatsapp, storeUrl, canBook: Boolean(bookingUrl) })
  const products = await db.product.findMany({
    where: { businessId: ctx.businessId, active: true, price: { gt: 0 } },
    select: { id: true, name: true, price: true, imageUrl: true },
    orderBy: { name: "asc" },
    take: 500,
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="OrdenSimple Links"
        description="Tu página de enlaces. Se guarda sola mientras editas y se ve en internet cuando publicas."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/links/estadisticas">
              <BarChart3 /> Estadísticas
            </Link>
          </Button>
        }
      />
      <LinksEditor
        initial={content}
        slug={page.slug}
        published={page.published}
        pendingChanges={!page.live || JSON.stringify(page.draft) !== JSON.stringify(page.live)}
        publicPrefix={publicPrefix}
        qrPrefix={`${origin}${linkPath("")}`}
        products={products.map((p) => ({ id: p.id, name: p.name, price: formatMoney(p.price, business.currency), imageUrl: p.imageUrl }))}
        bookingUrl={bookingUrl}
        storeUrl={storeUrl}
        logoUrl={logoUrlFor(business)}
        pro={linksPro(business)}
        today={today}
        defaults={{ whatsapp: business.storeWhatsapp, email: ctx.user.email }}
      />
    </div>
  )
}
