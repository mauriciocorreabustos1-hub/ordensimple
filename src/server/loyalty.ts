import "server-only"
import { canUseFeature } from "@/lib/plans"
import { earnedFor, type LoyaltyConfig, type LoyaltyEarned } from "@/lib/loyalty"
import type { Tx } from "@/server/sale-core"
import type { BusinessContext } from "@/server/session"

// Tarjetas de fidelidad: sumar al vender y descontar si la venta se elimina o se corrige.

export const LOYALTY_SETTINGS = {
  loyaltyEnabled: true,
  loyaltyMode: true,
  loyaltyGoal: true,
  loyaltyReward: true,
  loyaltyMinPurchase: true,
  loyaltyPointValue: true,
} as const

export function loyaltyConfig(s: { loyaltyMode: "STAMPS" | "POINTS"; loyaltyGoal: number; loyaltyReward: string | null; loyaltyMinPurchase: number; loyaltyPointValue: number }): LoyaltyConfig {
  return { mode: s.loyaltyMode, goal: s.loyaltyGoal, reward: s.loyaltyReward, minPurchase: s.loyaltyMinPurchase, pointValue: s.loyaltyPointValue }
}

/** Lo que ganaría esta venta: la tarjeta del cliente y cuánto. Null si no corresponde. */
async function planEarn(tx: Tx, ctx: BusinessContext, customerId: string | null | undefined, total: number) {
  if (!customerId || total <= 0 || !canUseFeature(ctx.business.plan, "loyalty")) return null
  const settings = await tx.businessSettings.findUnique({ where: { businessId: ctx.businessId }, select: LOYALTY_SETTINGS })
  if (!settings?.loyaltyEnabled) return null
  const card = await tx.loyaltyCard.findUnique({ where: { customerId }, select: { id: true, businessId: true, customer: { select: { name: true } } } })
  if (!card || card.businessId !== ctx.businessId) return null
  const cfg = loyaltyConfig(settings)
  const earned = earnedFor(cfg, total)
  return earned > 0 ? { card, cfg, earned } : null
}

async function grant(tx: Tx, ctx: BusinessContext, saleId: string, plan: NonNullable<Awaited<ReturnType<typeof planEarn>>>, earned: number): Promise<LoyaltyEarned> {
  const updated = await tx.loyaltyCard.update({ where: { id: plan.card.id }, data: { balance: { increment: earned } }, select: { balance: true } })
  await tx.loyaltyMovement.create({ data: { cardId: plan.card.id, kind: "EARN", amount: earned, saleId, createdById: ctx.user.id } })
  return { customerName: plan.card.customer.name, mode: plan.cfg.mode, earned, balance: updated.balance, goal: plan.cfg.goal }
}

/**
 * Si el cliente de la venta tiene tarjeta, le suma sus sellos o puntos (dentro de la misma transacción).
 * Solo con el plan que la incluye, la tarjeta activada y una venta positiva (no una devolución).
 */
export async function earnLoyalty(tx: Tx, ctx: BusinessContext, saleId: string, customerId: string | null | undefined, total: number): Promise<LoyaltyEarned | null> {
  const plan = await planEarn(tx, ctx, customerId, total)
  return plan ? grant(tx, ctx, saleId, plan, plan.earned) : null
}

/**
 * Quita lo que ganó una venta (al eliminarla). Nunca deja la tarjeta bajo cero: si el cliente ya canjeó esos sellos,
 * se descuenta lo que queda. Devuelve, por tarjeta, lo que no se alcanzó a descontar.
 */
export async function revertLoyalty(tx: Tx, saleId: string) {
  const shortfall = new Map<string, number>()
  const movements = await tx.loyaltyMovement.findMany({ where: { saleId }, select: { id: true, cardId: true, amount: true } })
  for (const m of movements) {
    const card = await tx.loyaltyCard.findUnique({ where: { id: m.cardId }, select: { balance: true } })
    const take = card ? Math.min(card.balance, m.amount) : 0
    if (take > 0) {
      // Solo si el saldo sigue alcanzando (si cambió entretanto, la transacción se anula).
      const r = await tx.loyaltyCard.updateMany({ where: { id: m.cardId, balance: { gte: take } }, data: { balance: { decrement: take } } })
      if (r.count !== 1) throw new Error("LOYALTY_CHANGED")
    }
    if (m.amount > take) shortfall.set(m.cardId, (shortfall.get(m.cardId) ?? 0) + m.amount - take)
    await tx.loyaltyMovement.delete({ where: { id: m.id } })
  }
  return shortfall
}

/**
 * Al editar una venta: si el cliente y lo ganado no cambian, no se toca la tarjeta. Si cambian, se descuenta lo
 * anterior y se suma lo nuevo. Pero si lo que ganó esta venta ya se canjeó (la tarjeta no alcanza para descontarlo),
 * la tarjeta queda como está: así nunca se regalan sellos o puntos moviendo la venta de un cliente a otro.
 */
export async function relinkLoyalty(tx: Tx, ctx: BusinessContext, saleId: string, customerId: string | null | undefined, total: number) {
  const before = await tx.loyaltyMovement.findMany({ where: { saleId }, select: { cardId: true, amount: true } })
  const plan = await planEarn(tx, ctx, customerId, total)
  if (plan && before.length === 1 && before[0].cardId === plan.card.id && before[0].amount === plan.earned) return
  if (!plan && !before.length) return
  for (const m of before) {
    const card = await tx.loyaltyCard.findUnique({ where: { id: m.cardId }, select: { balance: true } })
    if (card && card.balance < m.amount) return
  }
  await revertLoyalty(tx, saleId)
  if (plan) await grant(tx, ctx, saleId, plan, plan.earned)
}
