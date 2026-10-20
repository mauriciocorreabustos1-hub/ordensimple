import "server-only"
import { db } from "@/lib/db"

export type MemberStats = {
  userId: string
  /** Lo que vendió menos lo que se devolvió de sus ventas. */
  net: number
  count: number
  discounts: number
  returned: number
}

/**
 * Ventas por trabajador entre dos fechas. Las devoluciones se le restan a quien hizo la venta original
 * (no a quien la devolvió), para que la meta y la comisión sean justas.
 */
export async function salesByMember(businessId: string, from: Date, to: Date): Promise<Map<string, MemberStats>> {
  const date = { gte: from, lt: to }
  const [sales, returns] = await Promise.all([
    db.sale.groupBy({
      by: ["createdById"],
      where: { businessId, date, returnOfId: null },
      _sum: { total: true, discount: true },
      _count: { _all: true },
    }),
    db.sale.findMany({
      where: { businessId, date, returnOfId: { not: null } },
      select: { total: true, createdById: true, returnOf: { select: { createdById: true } } },
    }),
  ])
  const map = new Map<string, MemberStats>()
  const get = (userId: string) => {
    let m = map.get(userId)
    if (!m) map.set(userId, (m = { userId, net: 0, count: 0, discounts: 0, returned: 0 }))
    return m
  }
  for (const s of sales) {
    if (!s.createdById) continue
    const m = get(s.createdById)
    m.net += s._sum.total ?? 0
    m.count += s._count._all
    m.discounts += s._sum.discount ?? 0
  }
  for (const r of returns) {
    const seller = r.returnOf?.createdById ?? r.createdById
    if (!seller) continue
    const m = get(seller)
    m.net += r.total
    m.returned -= r.total
  }
  return map
}

/** Comisión sobre lo vendido (sin contar lo devuelto). Nunca negativa. */
export function commissionOf(net: number, rate: number | null) {
  return rate ? Math.max(0, Math.round(net * rate)) : 0
}
