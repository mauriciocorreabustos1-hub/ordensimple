"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { addDays, dateKeyToUtc } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { couponSchema, idSchema, promotionSchema, type CouponInput, type PromotionInput } from "@/lib/validations"
import { normalizeCode } from "@/server/coupons"
import { assertCan, requireBusiness, type BusinessContext } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

const PRO_ONLY = "Las promociones y cupones son parte del plan Pro."
const minuteOf = (hhmm: string | null) => (hhmm ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) : null)

function revalidate() {
  revalidatePath("/dashboard", "layout")
  revalidatePath("/tienda/[slug]", "page")
}

function guard(ctx: BusinessContext) {
  assertCan(ctx, "products:manage")
  return canUseFeature(ctx.business.plan, "promos") ? null : PRO_ONLY
}

async function promotionData(ctx: BusinessContext, input: PromotionInput) {
  const parsed = promotionSchema.safeParse(input)
  if (!parsed.success) return { error: validationError(parsed.error) }
  const d = parsed.data
  // Los productos y la categoría tienen que ser de este negocio.
  const productIds = d.scope === "PRODUCTS" ? [...new Set(d.productIds)] : []
  if (productIds.length && (await db.product.count({ where: { businessId: ctx.businessId, id: { in: productIds } } })) !== productIds.length) {
    return { error: { ok: false, message: "Uno de los productos ya no existe. Recarga la página." } as ActionResult<never> }
  }
  const categoryId = d.scope === "CATEGORY" ? d.categoryId : null
  if (categoryId && !(await db.category.findFirst({ where: { id: categoryId, businessId: ctx.businessId }, select: { id: true } }))) {
    return { error: { ok: false, message: "Esa categoría ya no existe. Recarga la página." } as ActionResult<never> }
  }
  return {
    data: {
      name: d.name,
      kind: d.kind,
      percent: d.kind === "PERCENT" ? d.percent : null,
      buyQty: d.kind === "BUY_X_PAY_Y" ? d.buyQty : null,
      payQty: d.kind === "BUY_X_PAY_Y" ? d.payQty : null,
      scope: d.scope,
      productIds,
      categoryId,
      // Las fechas son días completos en la hora del negocio: "hasta el 31" incluye todo el 31.
      startsAt: d.startsAt ? dateKeyToUtc(d.startsAt, ctx.timezone) : null,
      endsAt: d.endsAt ? addDays(dateKeyToUtc(d.endsAt, ctx.timezone), 1, ctx.timezone) : null,
      weekdays: [...new Set(d.weekdays)].sort(),
      fromMinute: minuteOf(d.fromTime),
      toMinute: minuteOf(d.toTime),
      inStore: d.inStore,
      online: d.online,
      active: d.active,
    },
  }
}

export async function savePromotion(id: string | null, input: PromotionInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (id !== null && !idSchema.safeParse(id).success) return { ok: false, message: "Promoción no encontrada." }
  try {
    const blocked = guard(ctx)
    if (blocked) return { ok: false, message: blocked }
    const r = await promotionData(ctx, input)
    if ("error" in r) return r.error!
    if (id) {
      const u = await db.promotion.updateMany({ where: { id, businessId: ctx.businessId }, data: r.data })
      if (!u.count) return { ok: false, message: "Promoción no encontrada." }
    } else {
      if ((await db.promotion.count({ where: { businessId: ctx.businessId } })) >= 100) return { ok: false, message: "Tienes muchas promociones. Elimina las que ya no uses." }
      await db.promotion.create({ data: { ...r.data, businessId: ctx.businessId } })
    }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: id ? "Promoción guardada" : "Promoción creada" }
}

export async function setPromotionActive(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Promoción no encontrada." }
  try {
    assertCan(ctx, "products:manage")
    await db.promotion.updateMany({ where: { id, businessId: ctx.businessId }, data: { active: Boolean(active) } })
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: active ? "Promoción activada" : "Promoción pausada" }
}

export async function deletePromotion(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Promoción no encontrada." }
  try {
    assertCan(ctx, "products:manage")
    // Las ventas que la usaron conservan el nombre y el monto descontado.
    await db.promotion.deleteMany({ where: { id, businessId: ctx.businessId } })
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Promoción eliminada" }
}

export async function saveCoupon(id: string | null, input: CouponInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (id !== null && !idSchema.safeParse(id).success) return { ok: false, message: "Cupón no encontrado." }
  const parsed = couponSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const d = parsed.data
  try {
    const blocked = guard(ctx)
    if (blocked) return { ok: false, message: blocked }
    const data = {
      code: normalizeCode(d.code),
      percent: d.percent,
      amount: d.amount,
      minTotal: d.minTotal,
      maxUses: d.maxUses,
      endsAt: d.endsAt ? addDays(dateKeyToUtc(d.endsAt, ctx.timezone), 1, ctx.timezone) : null,
      active: d.active,
    }
    const taken = await db.storeCoupon.findFirst({ where: { businessId: ctx.businessId, code: data.code, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })
    if (taken) return { ok: false, message: `Ya tienes un cupón ${data.code}.` }
    if (id) {
      const u = await db.storeCoupon.updateMany({ where: { id, businessId: ctx.businessId }, data })
      if (!u.count) return { ok: false, message: "Cupón no encontrado." }
    } else {
      if ((await db.storeCoupon.count({ where: { businessId: ctx.businessId } })) >= 200) return { ok: false, message: "Tienes muchos cupones. Elimina los que ya no uses." }
      await db.storeCoupon.create({ data: { ...data, businessId: ctx.businessId } })
    }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: id ? "Cupón guardado" : "Cupón creado" }
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Cupón no encontrado." }
  try {
    assertCan(ctx, "products:manage")
    await db.storeCoupon.deleteMany({ where: { id, businessId: ctx.businessId } })
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Cupón eliminado" }
}
