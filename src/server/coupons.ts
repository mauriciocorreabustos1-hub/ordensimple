import "server-only"
import { db } from "@/lib/db"

export type CouponInfo = { id: string; code: string; percent: number | null; amount: number | null; minTotal: number; maxUses: number | null; uses: number }

/** Los códigos se guardan y comparan en mayúsculas y sin espacios. */
export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "")
}

/** Cupón vigente de un negocio con ese código (o el motivo por el que no sirve). */
export async function findCoupon(businessId: string, rawCode: string): Promise<{ coupon: CouponInfo } | { error: string }> {
  const code = normalizeCode(rawCode)
  if (!code) return { error: "Escribe el código del cupón." }
  const c = await db.storeCoupon.findUnique({
    where: { businessId_code: { businessId, code } },
    select: { id: true, code: true, percent: true, amount: true, minTotal: true, maxUses: true, uses: true, endsAt: true, active: true },
  })
  if (!c || !c.active) return { error: "Ese cupón no existe." }
  if (c.endsAt && c.endsAt <= new Date()) return { error: "Ese cupón ya venció." }
  if (c.maxUses !== null && c.uses >= c.maxUses) return { error: "Ese cupón ya se usó todas las veces que se podía." }
  return { coupon: c }
}

/** Cuánto descuenta el cupón sobre un monto (después de las promociones). */
export function couponAmount(c: Pick<CouponInfo, "percent" | "amount">, base: number) {
  if (base <= 0) return 0
  if (c.percent) return Math.min(base, Math.round((base * Math.min(100, c.percent)) / 100))
  return Math.min(base, Math.max(0, c.amount ?? 0))
}
