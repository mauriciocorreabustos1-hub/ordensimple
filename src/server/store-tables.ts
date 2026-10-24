import "server-only"
import { db } from "@/lib/db"
import { isFoodBusiness, tableLabels } from "@/lib/business-kind"

/**
 * Mesas del local para la carta con QR: las de Configuración (Mesa 1…N y las que nombró). Solo negocios de comida.
 * Un pedido que llega desde la carta trae su mesa; si no es una de estas, se trata como un pedido normal.
 */
export async function storeTables(businessId: string) {
  const b = await db.business.findUnique({
    where: { id: businessId },
    select: { type: true, settings: { select: { tableCount: true, tableExtras: true } } },
  })
  if (!b || !isFoodBusiness(b.type) || !b.settings) return []
  return tableLabels(b.settings.tableCount, b.settings.tableExtras)
}
