import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { connectMercadoLibre, readMlState } from "@/server/mercadolibre"
import { logLicense } from "@/server/licenses"
import { requireAdmin } from "@/server/admin"

// Vuelta de Mercado Libre después de autorizar. Solo vale si vuelve el mismo administrador que tocó "Conectar".
export async function GET(request: Request) {
  const admin = await requireAdmin()
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = readMlState(url.searchParams.get("state") ?? "", admin.email)
  if (!code || !state) redirect("/admin?ml=error#licencias")
  let ok = true
  try {
    const account = await connectMercadoLibre(code, state.verifier, admin.email)
    await logLicense(db, { kind: "conexion", detail: `Cuenta de Mercado Libre ${account.nickname ?? account.sellerId} conectada por ${admin.email}` })
  } catch (error) {
    console.error("[mercadolibre] no se pudo conectar", error)
    ok = false
  }
  redirect(ok ? "/admin?ml=conectado#licencias" : "/admin?ml=error#licencias")
}
