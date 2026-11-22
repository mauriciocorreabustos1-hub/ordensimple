import type { Metadata, Viewport } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { LinkPageView, imageSrc } from "@/components/links/link-page-view"
import { LinkTracker } from "@/components/links/link-tracker"
import { getAppUrl } from "@/lib/app-url"
import { linkPath } from "@/lib/links"
import { getPublicLinkPage, linkPublicUrl, movedLinkSlug } from "@/server/links"

// La página se guarda armada y se rehace cada 5 minutos (o al tiro al publicar): abre rápido aunque la visiten
// muchas personas, y los precios y fotos de los productos se ponen al día solos.
export const revalidate = 300

export async function generateMetadata({ params }: PageProps<"/l/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const page = await getPublicLinkPage(slug)
  if (!page) return { title: "Página no encontrada", robots: { index: false } }
  const { profile, seo } = page.data.content
  const title = seo.title || profile.name
  const description = seo.description || profile.bio || `Enlaces, contacto y redes de ${profile.name}.`
  const origin = getAppUrl()
  // La foto para compartir: la portada, la foto de perfil o el logo (siempre con la dirección completa).
  const image = profile.cover ? imageSrc(profile.cover) : profile.avatar ? imageSrc(profile.avatar) : profile.useLogo ? page.data.logoUrl : null
  const url = linkPublicUrl(page.slug)
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "profile", title, description, url, siteName: profile.name, locale: "es_CL", ...(image ? { images: [{ url: `${origin}${image}`, alt: profile.name }] } : {}) },
    twitter: { card: profile.cover ? "summary_large_image" : "summary", title, description, ...(image ? { images: [`${origin}${image}`] } : {}) },
  }
}

export async function generateViewport({ params }: PageProps<"/l/[slug]">): Promise<Viewport> {
  const page = await getPublicLinkPage((await params).slug)
  return { themeColor: page?.data.content.theme.bg.color ?? "#ffffff" }
}

export default async function PublicLinkPage({ params }: PageProps<"/l/[slug]">) {
  const { slug } = await params
  const page = await getPublicLinkPage(slug)
  if (!page) {
    // Si el negocio cambió su nombre de usuario, los enlaces y QR viejos llevan al nuevo.
    const moved = await movedLinkSlug(slug)
    if (moved) permanentRedirect(linkPath(moved))
    notFound()
  }
  return (
    <>
      <LinkPageView data={page.data} className="min-h-dvh" />
      <LinkTracker slug={page.slug} />
    </>
  )
}
