import { getAppUrl } from "@/lib/app-url"
import { buildVCard, cardPath } from "@/lib/contact-card"
import { getPublicCard, getPublicCardPhoto } from "@/server/contact-cards"

// El archivo para guardar el contacto en iPhone y Android. Lleva solo lo que la persona autorizó.
export async function GET(_request: Request, { params }: RouteContext<"/perfil/[slug]/contacto.vcf">) {
  const { slug } = await params
  const card = await getPublicCard(slug)
  if (!card) return new Response("No encontrada", { status: 404 })
  const photo = await getPublicCardPhoto(slug)
  const vcard = buildVCard(card, {
    url: `${getAppUrl()}${cardPath(card.slug)}`,
    photo: photo ? { type: photo.type, base64: Buffer.from(photo.data).toString("base64") } : null,
  })
  return new Response(vcard, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${card.slug}.vcf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
