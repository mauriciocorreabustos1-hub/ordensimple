import { db } from "@/lib/db"
import { businessLogoUrl } from "@/components/app/business-logo"
import { loyaltyPath } from "@/lib/loyalty"

// Al agregar la tarjeta a la pantalla de inicio, se instala como una app que abre esta tarjeta
// (con el nombre y logo del negocio), y no el panel de OrdenSimple.

export async function GET(_request: Request, { params }: RouteContext<"/tarjeta/[token]/manifest.webmanifest">) {
  const { token } = await params
  const card = /^[\w-]{16,64}$/.test(token)
    ? await db.loyaltyCard.findUnique({ where: { token }, select: { business: { select: { id: true, name: true, logoUpdatedAt: true } } } })
    : null
  if (!card) return new Response("No encontrada", { status: 404 })
  const b = card.business
  const logo = businessLogoUrl(b.id, b.logoUpdatedAt)
  const path = loyaltyPath(token)
  return Response.json(
    {
      name: `Tarjeta ${b.name}`,
      short_name: b.name.slice(0, 24),
      id: path,
      start_url: path,
      scope: path,
      display: "standalone",
      background_color: "#f8faf9",
      theme_color: "#007653",
      icons: logo
        ? [{ src: logo, sizes: "256x256", purpose: "any" }]
        : [
            { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
          ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" } },
  )
}
