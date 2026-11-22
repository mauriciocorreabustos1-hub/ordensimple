import { createHash } from "node:crypto"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAppUrl } from "@/lib/app-url"
import { detectDevice, detectSource, isBot, isValidLinkSlug, readContent } from "@/lib/links"
import { allowAttempt } from "@/server/rate-limit"

// Visitas y clics de las páginas de enlaces. Es público (lo llama la página de cualquier visitante), así que:
// solo acepta envíos desde las propias páginas, ignora a los robots, no guarda la IP (solo una huella anónima que
// cambia cada día), no cuenta dos veces la misma visita en media hora y frena a quien envíe demasiados.

const schema = z.object({
  slug: z.string().max(40),
  kind: z.enum(["VIEW", "CLICK"]),
  blockId: z.string().regex(/^[a-z0-9]{6,16}$/).optional(),
  ref: z.string().max(500).nullable().optional(),
  search: z.string().max(500).nullable().optional(),
})

const noContent = () => new Response(null, { status: 204 })

function allowedOrigin(origin: string | null) {
  if (!origin) return true
  try {
    const host = new URL(origin).host
    const ok = [new URL(getAppUrl()).host, process.env.LINKS_HOST?.trim(), "localhost:3000"].filter(Boolean)
    return ok.includes(host) || host === "ordensimple.cl" || host.endsWith(".ordensimple.cl")
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const ua = request.headers.get("user-agent") ?? ""
  if (isBot(ua)) return noContent()
  if (!allowedOrigin(request.headers.get("origin"))) return new Response(null, { status: 403 })
  // Los navegadores siempre avisan desde dónde se envía; si dice que viene de otro sitio, no se cuenta.
  const site = request.headers.get("sec-fetch-site")
  if (site && site !== "same-origin" && site !== "same-site") return new Response(null, { status: 403 })
  const raw = await request.text()
  if (raw.length > 2000) return new Response(null, { status: 413 })
  let body: z.infer<typeof schema>
  try {
    body = schema.parse(JSON.parse(raw))
  } catch {
    return new Response(null, { status: 400 })
  }
  if (!isValidLinkSlug(body.slug)) return noContent()

  const page = await db.linkPage.findUnique({ where: { slug: body.slug }, select: { id: true, published: true, live: true } })
  if (!page?.published) return noContent()
  if (body.kind === "CLICK") {
    const content = readContent(page.live)
    if (!body.blockId || !content?.blocks.some((b) => b.id === body.blockId)) return noContent()
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "?"
  const day = new Date().toISOString().slice(0, 10)
  const visitor = createHash("sha256").update(`${ip}|${ua}|${day}|${process.env.BETTER_AUTH_SECRET ?? "links"}`).digest("base64url").slice(0, 22)

  // Dos límites: por visitante y por conexión (quien cambie el navegador que informa para inflar las cifras igual queda
  // frenado). La conexión se guarda solo como huella, nunca la IP.
  const conn = createHash("sha256").update(`${ip}|${day}|${process.env.BETTER_AUTH_SECRET ?? "links"}`).digest("base64url").slice(0, 22)
  if (!(await allowAttempt(`links-ip:${conn}`, 300, 10 * 60_000))) return noContent()
  if (!(await allowAttempt(`links:${visitor}`, 120, 10 * 60_000))) return noContent()
  if (body.kind === "VIEW") {
    const recent = await db.linkEvent.findFirst({
      where: { pageId: page.id, visitor, kind: "VIEW", createdAt: { gte: new Date(Date.now() - 30 * 60_000) } },
      select: { id: true },
    })
    if (recent) return noContent()
  }

  const country = request.headers.get("x-vercel-ip-country")
  await db.linkEvent.create({
    data: {
      pageId: page.id,
      kind: body.kind,
      blockId: body.kind === "CLICK" ? body.blockId : null,
      visitor,
      source: body.kind === "VIEW" ? detectSource(body.ref, body.search) : null,
      device: detectDevice(ua),
      country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    },
  })
  return noContent()
}
