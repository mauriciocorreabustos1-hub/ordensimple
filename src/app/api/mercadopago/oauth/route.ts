import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { can } from "@/lib/roles"
import { connectAccount, readOauthState } from "@/server/mp-marketplace"
import { getSession } from "@/server/session"

// Vuelta de Mercado Pago después de autorizar: se guardan (cifradas) las claves de la cuenta del negocio.
// Solo vale si la vuelta es de la misma persona que tocó "Conectar" y sigue pudiendo administrar ese negocio.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = readOauthState(url.searchParams.get("state") ?? "")
  const session = await getSession()
  if (!code || !state || !session || session.user.id !== state.userId) redirect("/dashboard/cobros?error=conexion")
  const member = await db.businessMember.findFirst({ where: { businessId: state.businessId, userId: state.userId }, select: { role: true } })
  if (!member || !can(member.role, "settings:manage")) redirect("/dashboard/cobros?error=permiso")
  let ok = true
  try {
    await connectAccount(state.businessId, state.userId, code)
  } catch (error) {
    console.error("[mercadopago] no se pudo conectar", error)
    ok = false
  }
  redirect(ok ? "/dashboard/cobros?conectado=1" : "/dashboard/cobros?error=conexion")
}
