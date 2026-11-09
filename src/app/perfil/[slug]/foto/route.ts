import { getPublicCardPhoto } from "@/server/contact-cards"

// Foto de la tarjeta: solo responde si la persona autorizó mostrarla. Caché corta, para que al quitarla deje de verse pronto.
export async function GET(_request: Request, { params }: RouteContext<"/perfil/[slug]/foto">) {
  const { slug } = await params
  const photo = await getPublicCardPhoto(slug)
  if (!photo) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.type, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" },
  })
}
