import { redirect } from "next/navigation"
import { mercadoLibreConfigured, mlAuthorizationUrl } from "@/server/mercadolibre"
import { requireAdmin } from "@/server/admin"

// "Conectar Mercado Libre" en el panel de administración: lleva a autorizar la cuenta de vendedor.
export async function GET() {
  const admin = await requireAdmin()
  if (!mercadoLibreConfigured()) redirect("/admin?ml=sin-claves#licencias")
  redirect(mlAuthorizationUrl(admin.email))
}
