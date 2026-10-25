import type { Metadata } from "next"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { LoyaltyBoard, type LoyaltyCardRow } from "@/components/loyalty/loyalty-board"
import { db } from "@/lib/db"
import { canUseFeature } from "@/lib/plans"
import { can, canApproveDiscounts } from "@/lib/roles"
import { loyaltyConfig, LOYALTY_SETTINGS } from "@/server/loyalty"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Tarjeta de fidelidad" }

const DEFAULTS = { loyaltyEnabled: false, loyaltyMode: "STAMPS" as const, loyaltyGoal: 10, loyaltyReward: null, loyaltyMinPurchase: 0, loyaltyPointValue: 1000 }

export default async function LoyaltyPage() {
  const ctx = await requireBusiness()
  if (!canUseFeature(ctx.business.plan, "loyalty")) {
    return <ProGate title="Tarjeta de fidelidad" description="Tus clientes juntan sellos o puntos en una tarjeta que guardan en su celular, y vuelven por su premio." />
  }
  const [settings, cards, customers] = await Promise.all([
    db.businessSettings.findUnique({ where: { businessId: ctx.businessId }, select: LOYALTY_SETTINGS }),
    db.loyaltyCard.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { updatedAt: "desc" },
      take: 1000,
      select: {
        id: true,
        token: true,
        balance: true,
        rewards: true,
        updatedAt: true,
        customer: { select: { name: true, phone: true } },
        movements: { orderBy: { createdAt: "desc" }, take: 8, select: { id: true, kind: true, amount: true, createdAt: true } },
      },
    }),
    db.customer.findMany({ where: { businessId: ctx.businessId, loyaltyCard: null }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 2000 }),
  ])
  const s = settings ?? DEFAULTS
  const rows: LoyaltyCardRow[] = cards.map((c) => ({
    id: c.id,
    token: c.token,
    customerName: c.customer.name,
    customerPhone: c.customer.phone,
    balance: c.balance,
    rewards: c.rewards,
    updatedAt: c.updatedAt.toISOString(),
    movements: c.movements.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  }))

  return (
    <div className="space-y-6">
      <PageHeader title="Tarjeta de fidelidad" description="Tus clientes juntan sellos o puntos en su celular cada vez que te compran, y vuelven por su premio." />
      <LoyaltyBoard
        cards={rows}
        customers={customers}
        cfg={loyaltyConfig(s)}
        enabled={s.loyaltyEnabled}
        currency={ctx.currency}
        timezone={ctx.timezone}
        businessName={ctx.business.name}
        canConfigure={can(ctx.role, "settings:manage")}
        canDelete={can(ctx.role, "sales:delete")}
        canAdjust={canApproveDiscounts(ctx.role)}
      />
    </div>
  )
}
