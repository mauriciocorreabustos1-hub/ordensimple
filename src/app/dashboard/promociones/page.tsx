import type { Metadata } from "next"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { PromotionsManager } from "@/components/promotions/promotions-manager"
import { db } from "@/lib/db"
import { addDays, toDateKey } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "Promociones" }

const hhmm = (m: number | null) => (m === null ? null : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`)

export default async function PromotionsPage() {
  const ctx = await requireBusiness()
  requirePermission(ctx, "products:manage")
  if (!canUseFeature(ctx.business.plan, "promos")) {
    return <ProGate title="Promociones y cupones" description="2×1, descuentos por categoría, happy hour y cupones para tu tienda online, que se aplican solos." />
  }
  const since = addDays(new Date(), -30, ctx.timezone)
  const [promotions, coupons, products, categories, usage] = await Promise.all([
    db.promotion.findMany({ where: { businessId: ctx.businessId }, orderBy: [{ active: "desc" }, { createdAt: "desc" }] }),
    db.storeCoupon.findMany({ where: { businessId: ctx.businessId }, orderBy: [{ active: "desc" }, { createdAt: "desc" }] }),
    db.product.findMany({ where: { businessId: ctx.businessId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.category.findMany({ where: { businessId: ctx.businessId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.salePromotion.groupBy({
      by: ["promotionId"],
      where: { promotionId: { not: null }, sale: { businessId: ctx.businessId, date: { gte: since } } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ])
  const used = new Map(usage.map((u) => [u.promotionId, { amount: u._sum.amount ?? 0, count: u._count._all }]))
  // Las fechas se muestran como días (el término guardado es el día siguiente a las 00:00).
  const dayOf = (d: Date | null, end = false) => (d ? toDateKey(end ? addDays(d, -1, ctx.timezone) : d, ctx.timezone) : null)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promociones"
        description="Descuentos que se aplican solos al vender, en las comandas y en tu tienda online: 2×1, % en productos o categorías, happy hour y cupones."
      />
      <PromotionsManager
        currency={ctx.currency}
        now={new Date().toISOString()}
        timezone={ctx.timezone}
        products={products}
        categories={categories}
        storeEnabled={Boolean(ctx.business.storeEnabled && ctx.business.storeSlug)}
        promotions={promotions.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          percent: p.percent,
          buyQty: p.buyQty,
          payQty: p.payQty,
          scope: p.scope,
          productIds: p.productIds,
          categoryId: p.categoryId,
          startsAt: dayOf(p.startsAt),
          endsAt: dayOf(p.endsAt, true),
          startsAtIso: p.startsAt?.toISOString() ?? null,
          endsAtIso: p.endsAt?.toISOString() ?? null,
          weekdays: p.weekdays,
          fromTime: hhmm(p.fromMinute),
          toTime: hhmm(p.toMinute),
          fromMinute: p.fromMinute,
          toMinute: p.toMinute,
          inStore: p.inStore,
          online: p.online,
          active: p.active,
          used: used.get(p.id) ?? { amount: 0, count: 0 },
        }))}
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          percent: c.percent,
          amount: c.amount,
          minTotal: c.minTotal,
          maxUses: c.maxUses,
          uses: c.uses,
          endsAt: dayOf(c.endsAt, true),
          expired: Boolean(c.endsAt && c.endsAt <= new Date()),
          active: c.active,
        }))}
      />
    </div>
  )
}
