import { z } from "zod"
import { recordError } from "@/server/error-log"
import { allowAttempt } from "@/server/rate-limit"

// Recibe errores que ocurren en el navegador (pantallas de error de la app).
const schema = z.object({
  message: z.string().min(1).max(1000),
  digest: z.string().max(100).optional(),
  path: z.string().max(300).optional(),
  stack: z.string().max(4000).optional(),
})

export async function POST(request: Request) {
  // Solo se aceptan reportes enviados desde la propia página.
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")
  if (!origin || !host || new URL(origin).host !== host) return new Response(null, { status: 403 })

  // Así nadie puede llenar el registro con reportes falsos y tapar los errores reales.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?"
  if (!(await allowAttempt(`errores:${ip}`, 20, 60 * 60 * 1000))) return new Response(null, { status: 429 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return new Response(null, { status: 400 })

  await recordError({
    source: "navegador",
    ...parsed.data,
    userAgent: request.headers.get("user-agent") ?? undefined,
  })
  return new Response(null, { status: 204 })
}
