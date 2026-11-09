import { cardPath } from "@/lib/contact-card"
import { getPublicCard } from "@/server/contact-cards"

// Al instalar la tarjeta, queda como una app que abre solo esta tarjeta.
export async function GET(_request: Request, { params }: RouteContext<"/perfil/[slug]/manifest.webmanifest">) {
  const { slug } = await params
  const card = await getPublicCard(slug)
  if (!card) return new Response("No encontrada", { status: 404 })
  const path = cardPath(card.slug)
  const icon = (size: number, purpose: string) => ({ src: `${path}/icono/${size}?v=${card.version}`, sizes: `${size}x${size}`, type: "image/png", purpose })
  return Response.json(
    {
      name: card.fullName,
      short_name: card.fullName.split(" ")[0].slice(0, 12),
      description: [card.jobTitle, card.company].filter(Boolean).join(", ") || "Tarjeta de presentación digital",
      lang: "es-CL",
      id: path,
      start_url: path,
      scope: path,
      display: "standalone",
      orientation: "portrait",
      background_color: "#014f36",
      theme_color: "#014f36",
      icons: [icon(192, "any"), icon(512, "any"), icon(512, "maskable")],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" } },
  )
}
