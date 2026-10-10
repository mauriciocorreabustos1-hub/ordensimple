import { NextResponse } from "next/server"
import { REFERRAL_COOKIE } from "@/lib/referrals"
import { parsePlanChoice } from "@/lib/plans"

// "¿No te invitó nadie? Quitar": borra la invitación guardada en este navegador y vuelve al registro.
export async function GET(request: Request) {
  const choice = parsePlanChoice(new URL(request.url).searchParams.get("plan"))
  const response = NextResponse.redirect(new URL(choice ? `/registro?plan=${choice}` : "/registro", request.url))
  response.cookies.delete(REFERRAL_COOKIE)
  return response
}
