import { sendBusinessAlerts } from "@/server/business-alerts"
import { sendOnboardingNudges } from "@/server/onboarding-emails"
import { sendVerifyReminders } from "@/server/verify-reminders"

// Vercel Cron llama esta ruta una vez al día (ver vercel.json) con el CRON_SECRET en la cabecera.
// Envía los correos de bienvenida y los avisos que cada negocio activó en Configuración.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 })
  }
  // Solo en desarrollo: ?ahora=2026-10-05T14:00:00Z para probar como si fuera otro día.
  const ahora = new URL(request.url).searchParams.get("ahora")
  const now = process.env.NODE_ENV !== "production" && ahora ? new Date(ahora) : new Date()
  const [bienvenida, avisos, verificacion] = await Promise.all([sendOnboardingNudges(now), sendBusinessAlerts(now), sendVerifyReminders(now)])
  return Response.json({ bienvenida, avisos, verificacion })
}
