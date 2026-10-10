import { NextResponse } from "next/server"
import { BILLING_ENABLED, checkoutPath, parsePlanChoice } from "@/lib/plans"
import { getSession } from "@/server/session"

// "Elegir Pro / Empresa" en Precios: con sesión va directo a pagar; sin sesión, a crear la cuenta (y después al pago).
export async function GET(request: Request, ctx: RouteContext<"/pagar/[plan]">) {
  const choice = BILLING_ENABLED ? parsePlanChoice((await ctx.params).plan) : null
  if (!choice) return NextResponse.redirect(new URL("/registro", request.url))
  const target = (await getSession()) ? checkoutPath(choice) : `/registro?plan=${choice}`
  return NextResponse.redirect(new URL(target, request.url))
}
