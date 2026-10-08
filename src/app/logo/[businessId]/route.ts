import { db } from "@/lib/db"

// Logo de un negocio. La dirección lleva ?v=<fecha del cambio>, así el navegador puede guardarlo mucho tiempo
// y pide el nuevo apenas cambia.
export async function GET(_request: Request, { params }: RouteContext<"/logo/[businessId]">) {
  const { businessId } = await params
  const logo = await db.businessLogo.findUnique({ where: { businessId: businessId.slice(0, 64) }, select: { data: true, type: true } })
  if (!logo) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
