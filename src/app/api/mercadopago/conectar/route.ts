import { redirect } from "next/navigation"
import { can } from "@/lib/roles"
import { authorizationUrl, oauthState, onlinePaymentsAvailable } from "@/server/mp-marketplace"
import { requireBusiness } from "@/server/session"

// Botón "Conectar Mercado Pago": lleva a Mercado Pago a autorizar a OrdenSimple a cobrar a nombre del negocio.
export async function GET() {
  const ctx = await requireBusiness()
  if (!onlinePaymentsAvailable() || !can(ctx.role, "settings:manage")) redirect("/dashboard/cobros?error=permiso")
  redirect(authorizationUrl(oauthState(ctx.businessId, ctx.user.id)))
}
