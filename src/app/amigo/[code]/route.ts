import { NextResponse } from "next/server"
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE } from "@/lib/referrals"
import { findReferrerByCode, findSpecialLink } from "@/server/referrals"

// Enlace de "Invita a un amigo" (ordensimple.cl/amigo/donpedro-k7m2): guarda quién invitó y lleva al registro.
export async function GET(request: Request, ctx: RouteContext<"/amigo/[code]">) {
  const { code } = await ctx.params
  const special = await findSpecialLink(code.toLowerCase())
  const referrer = special ? null : await findReferrerByCode(code.toLowerCase())
  if (!special && !referrer) return NextResponse.redirect(new URL("/", request.url))
  // Los enlaces especiales quedan como origen "enlace" con su código como campaña (se ve en "De dónde llegan").
  const target = special ? `/registro?utm_source=enlace&utm_campaign=${special.code}` : "/registro?utm_source=invitacion&utm_medium=amigo"
  const response = NextResponse.redirect(new URL(target, request.url))
  response.cookies.set(REFERRAL_COOKIE, code.toLowerCase(), {
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  })
  return response
}
