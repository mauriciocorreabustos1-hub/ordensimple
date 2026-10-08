import { db } from "@/lib/db"
import { getSession } from "@/server/session"

// Foto de perfil. Solo la ven personas con sesión iniciada. La dirección lleva ?v=<momento del cambio>.
export async function GET(_request: Request, { params }: RouteContext<"/foto/[userId]">) {
  if (!(await getSession())) return new Response(null, { status: 401 })
  const { userId } = await params
  const photo = await db.userPhoto.findUnique({ where: { userId: userId.slice(0, 64) }, select: { data: true, type: true } })
  if (!photo) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  })
}
