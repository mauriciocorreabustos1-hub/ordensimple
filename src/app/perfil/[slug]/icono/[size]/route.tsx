import { ImageResponse } from "next/og"
import { initialsOf } from "@/lib/contact-card"
import { getPublicCard, getPublicCardPhoto } from "@/server/contact-cards"

const SIZES = new Set([180, 192, 512])

// Ícono de la app instalada: la foto autorizada o, si no hay, las iniciales sobre el verde de la marca.
export async function GET(_request: Request, { params }: RouteContext<"/perfil/[slug]/icono/[size]">) {
  const { slug, size: raw } = await params
  const size = Number(raw)
  if (!SIZES.has(size)) return new Response("No encontrado", { status: 404 })
  const card = await getPublicCard(slug)
  if (!card) return new Response("No encontrada", { status: 404 })
  const photo = await getPublicCardPhoto(slug)
  const src = photo ? `data:${photo.type};base64,${Buffer.from(photo.data).toString("base64")}` : null
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#014f36", color: "#f2faf6", fontSize: size * 0.38, fontWeight: 700 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt="" width={size} height={size} style={{ objectFit: "cover" }} /> : initialsOf(card.fullName)}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  )
}
