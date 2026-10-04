"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/dates"
import { effectivePlan, PLAN_RANK, PLANS } from "@/lib/plans"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, type ActionResult } from "@/server/actions/result"

const codeSchema = z.string().trim().toUpperCase().min(3).max(30)

class CouponError extends Error {}

/** Canjea un código de descuento para el negocio activo (dueño o administrador). */
export async function redeemCoupon(rawCode: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = codeSchema.safeParse(rawCode)
  if (!parsed.success) return { ok: false, message: "Escribe el código tal como te llegó." }
  const code = parsed.data

  try {
    assertCan(ctx, "settings:manage")

    const message = await db.$transaction(async (tx) => {
      const coupon = await tx.coupon.findUnique({
        where: { code },
        include: { _count: { select: { redemptions: true } } },
      })
      const now = new Date()
      if (!coupon || !coupon.active) throw new CouponError("Ese código no existe o ya no está disponible.")
      if (coupon.expiresAt && coupon.expiresAt <= now) throw new CouponError("Ese código ya venció.")
      if (coupon.maxRedemptions !== null && coupon._count.redemptions >= coupon.maxRedemptions) {
        throw new CouponError("Ese código ya se usó el máximo de veces.")
      }

      const business = await tx.business.findUniqueOrThrow({
        where: { id: ctx.businessId },
        select: { plan: true, planExpiresAt: true, discountPercent: true },
      })
      const planName = PLANS[coupon.plan].name

      // Falla con P2002 si este negocio ya usó el código.
      await tx.couponRedemption.create({ data: { couponId: coupon.id, businessId: ctx.businessId, userId: ctx.user.id } })

      if (coupon.kind === "FREE_DAYS") {
        const current = effectivePlan(business, now)
        if (PLAN_RANK[current] > PLAN_RANK[coupon.plan]) {
          throw new CouponError(`Tu negocio ya tiene el plan ${PLANS[current].name}, que incluye todo lo de ${planName}.`)
        }
        if (current === coupon.plan && !business.planExpiresAt) {
          throw new CouponError(`Tu negocio ya tiene el plan ${planName} sin vencimiento.`)
        }
        // Si ya tenía este mismo plan vigente, los días se suman al final.
        const base = current === coupon.plan && business.planExpiresAt ? business.planExpiresAt : now
        const planExpiresAt = new Date(base.getTime() + (coupon.days ?? 0) * 86_400_000)
        await tx.business.update({ where: { id: ctx.businessId }, data: { plan: coupon.plan, planExpiresAt } })
        return `¡Listo! Tienes el plan ${planName} hasta el ${formatDate(planExpiresAt, ctx.timezone, { day: "numeric", month: "long", year: "numeric" })}.`
      }

      const percent = coupon.percentOff ?? 0
      if ((business.discountPercent ?? 0) >= percent) {
        throw new CouponError(`Ya tienes un descuento de ${business.discountPercent}%, igual o mejor que este.`)
      }
      await tx.business.update({ where: { id: ctx.businessId }, data: { discountPercent: percent, discountCode: coupon.code } })
      return `¡Listo! Guardamos tu ${percent}% de descuento en el plan ${planName}. Se aplicará cuando empieces a pagar.`
    })

    revalidatePath("/dashboard", "layout")
    return { ok: true, message }
  } catch (error) {
    if (error instanceof CouponError) return { ok: false, message: error.message }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "Tu negocio ya usó este código." }
    }
    return toActionError(error)
  }
}
