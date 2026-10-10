import { NextResponse } from "next/server"
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE } from "@/lib/referrals"
import { findReferrerByCode } from "@/server/referrals"

// Enlace de "Invita a un amigo" (ordensimple.cl/amigo/donpedro-k7m2): guarda quién invitó y lleva al registro.
export async function GET(request: Request, ctx: RouteContext<"/amigo/[code]">) {
  const { code } = await ctx.params
  const referrer = await findReferrerByCode(code.toLowerCase())
  if (!referrer) return NextResponse.redirect(new URL("/", request.url))
  const response = NextResponse.redirect(new URL("/registro?utm_source=invitacion&utm_medium=amigo", request.url))
  response.cookies.set(REFERRAL_COOKIE, code.toLowerCase(), {
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  })
  return response
}
