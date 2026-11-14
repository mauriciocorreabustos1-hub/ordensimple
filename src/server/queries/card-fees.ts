import "server-only"
import { cache } from "react"
import { db } from "@/lib/db"
import { hasCardFees, NO_CARD_FEES, type CardFees } from "@/lib/card-fees"

/** La comisión de la máquina de tarjetas que anotó el negocio (una consulta por petición). */
export const cardFeesOf = cache(async (businessId: string): Promise<CardFees> => {
  const s = await db.businessSettings.findUnique({ where: { businessId }, select: { cardFeeDebit: true, cardFeeCredit: true } })
  return s ? { debit: s.cardFeeDebit, credit: s.cardFeeCredit } : NO_CARD_FEES
})

/**
 * Lo que se quedó la máquina con los pagos con débito y crédito entre dos instantes [from, to), con la comisión
 * que el negocio tiene anotada hoy. Las devoluciones con tarjeta (ventas en negativo) la rebajan.
 */
export async function cardFeesBetween(businessId: string, from: Date, to: Date) {
  const fees = await cardFeesOf(businessId)
  if (!hasCardFees(fees)) return 0
  const groups = await db.sale.groupBy({
    by: ["paymentMethod"],
    where: { businessId, date: { gte: from, lt: to }, paymentMethod: { in: ["DEBIT", "CREDIT"] } },
    _sum: { total: true },
  })
  return Math.max(0, groups.reduce((s, g) => s + Math.round(((g._sum.total ?? 0) * (g.paymentMethod === "DEBIT" ? fees.debit : fees.credit)) / 100), 0))
}


