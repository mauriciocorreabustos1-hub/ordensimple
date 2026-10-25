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

/**
 * Si el cliente de la venta tiene tarjeta, le suma sus sellos o puntos (dentro de la misma transacción).
 * Solo con el plan que la incluye, la tarjeta activada y una venta positiva (no una devolución).
 */
export async function earnLoyalty(tx: Tx, ctx: BusinessContext, saleId: string, customerId: string | null | undefined, total: number): Promise<LoyaltyEarned | null> {
  if (!customerId || total <= 0 || !canUseFeature(ctx.business.plan, "loyalty")) return null
  const settings = await tx.businessSettings.findUnique({ where: { businessId: ctx.businessId }, select: LOYALTY_SETTINGS })
  if (!settings?.loyaltyEnabled) return null
  const card = await tx.loyaltyCard.findUnique({ where: { customerId }, select: { id: true, businessId: true, customer: { select: { name: true } } } })
  if (!card || card.businessId !== ctx.businessId) return null
  const cfg = loyaltyConfig(settings)
  const earned = earnedFor(cfg, total)
  if (earned <= 0) return null
  const updated = await tx.loyaltyCard.update({ where: { id: card.id }, data: { balance: { increment: earned } }, select: { balance: true } })
  await tx.loyaltyMovement.create({ data: { cardId: card.id, kind: "EARN", amount: earned, saleId, createdById: ctx.user.id } })
  return { customerName: card.customer.name, mode: cfg.mode, earned, balance: updated.balance, goal: cfg.goal }
}

/** Quita lo que ganó una venta (al eliminarla o antes de recalcularla al editarla). Nunca deja la tarjeta bajo cero. */
export async function revertLoyalty(tx: Tx, saleId: string) {
  const movements = await tx.loyaltyMovement.findMany({ where: { saleId }, select: { id: true, cardId: true, amount: true } })
  for (const m of movements) {
    const card = await tx.loyaltyCard.findUnique({ where: { id: m.cardId }, select: { balance: true } })
    if (card) await tx.loyaltyCard.update({ where: { id: m.cardId }, data: { balance: Math.max(0, card.balance - m.amount) } })
    await tx.loyaltyMovement.delete({ where: { id: m.id } })
  }
}
