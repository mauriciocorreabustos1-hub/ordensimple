import { streamText } from "ai"
import { z } from "zod"
import {
  ASSISTANT_MODEL,
  assistantContext,
  assistantEnabledFor,
  assistantQuestionsLeft,
  assistantSystemPrompt,
  recordAssistantUsage,
} from "@/server/assistant"
import { recordError } from "@/server/error-log"
import { requireBusiness } from "@/server/session"

// Chat del asistente: responde en partes (streaming) con la guía de OrdenSimple y los números del negocio.
export const maxDuration = 60

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(30),
})

const json = (status: number, message: string) => Response.json({ message }, { status })

export async function POST(request: Request) {
  // Solo desde la propia página.
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")
  if (!origin || !host || new URL(origin).host !== host) return new Response(null, { status: 403 })

  const ctx = await requireBusiness()
  if (!assistantEnabledFor(ctx.user.email)) return new Response(null, { status: 404 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") return json(400, "No entendí la pregunta.")

  if ((await assistantQuestionsLeft(ctx.businessId, ctx.timezone)) <= 0) {
    return json(429, "Llegaste al límite de preguntas de hoy. Mañana puedes seguir preguntando.")
  }

  const system = assistantSystemPrompt(await assistantContext(ctx))
  const result = streamText({
    model: ASSISTANT_MODEL,
    system,
    // Las últimas preguntas y respuestas bastan para seguir la conversación.
    messages: parsed.data.messages.slice(-12),
    maxOutputTokens: 700,
    temperature: 0.3,
    onFinish: async ({ totalUsage }) => {
      await recordAssistantUsage(ctx.businessId, ctx.user.id, totalUsage).catch(() => {})
    },
    onError: async ({ error }) => {
      await recordError({ source: "servidor", path: "/api/asistente", message: `Asistente IA: ${error instanceof Error ? error.message : String(error)}`.slice(0, 1000) }).catch(() => {})
    },
  })
  return result.toTextStreamResponse()
}
