import { sendOnboardingNudges } from "@/server/onboarding-emails"

// Vercel Cron llama esta ruta una vez al día (ver vercel.json) con el CRON_SECRET en la cabecera.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 })
  }
  const result = await sendOnboardingNudges()
  return Response.json(result)
}
