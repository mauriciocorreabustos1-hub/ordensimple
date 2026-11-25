import { timingSafeEqual } from "node:crypto"
import { sendBusinessAlerts } from "@/server/business-alerts"
import { sendOnboardingNudges } from "@/server/onboarding-emails"
import { sendVerifyReminders } from "@/server/verify-reminders"
import { processReferralRewards } from "@/server/referrals"
import { resumeGiftPauses } from "@/server/billing"
import { recordError } from "@/server/error-log"
import { mercadoLibre } from "@/server/mercadolibre"
import { retryMlDeliveries } from "@/server/ml-sales"
import { sendPlanReminders } from "@/server/plan-reminders"

// Con muchos negocios, enviar los correos puede tomar varios minutos.
export const maxDuration = 300

/** Corre una parte de la tarea diaria; si falla, queda en el registro de errores (y te llega un correo) sin frenar las demás. */
async function step<T>(name: string, run: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await recordError({ source: "servidor", message: `Tarea diaria (${name}): ${message}`, path: "/api/cron/diario", stack: error instanceof Error ? error.stack : undefined })
    return { error: message }
  }
}

// Vercel Cron llama esta ruta una vez al día (ver vercel.json) con el CRON_SECRET en la cabecera.
// Envía los correos de bienvenida y los avisos que cada negocio activó en Configuración.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response(null, { status: 401 })
  }
  // Solo en desarrollo: ?ahora=2026-10-05T14:00:00Z para probar como si fuera otro día.
  const ahora = new URL(request.url).searchParams.get("ahora")
  const now = process.env.NODE_ENV !== "production" && ahora ? new Date(ahora) : new Date()
  // Primero reactivar los cobros pausados como regalo: es lo que más importa que no se salte.
  const cobrosReanudados = await step("reanudar cobros", () => resumeGiftPauses(now))
  const [bienvenida, avisos, verificacion, invitaciones, codigosMercadoLibre, planes] = await Promise.all([
    step("bienvenida", () => sendOnboardingNudges(now)),
    step("avisos", () => sendBusinessAlerts(now)),
    step("confirmar correo", () => sendVerifyReminders(now)),
    step("invitaciones", () => processReferralRewards(now)),
    // Ventas que quedaron sin código y mensajes que no salieron. En paralelo: si Mercado Libre tarda, no frena los correos.
    step("códigos de Mercado Libre", () => retryMlDeliveries(mercadoLibre, { retryDelaysMs: [0, 2_000] })),
    // El plan está por vencer (5 días antes) o vence hoy.
    step("planes por vencer", () => sendPlanReminders(now)),
  ])
  return Response.json({ bienvenida, avisos, verificacion, invitaciones, cobrosReanudados, codigosMercadoLibre, planes })
}
