"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/dates"
import { effectivePlan, PLAN_RANK, PLANS } from "@/lib/plans"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, type ActionResult } from "@/server/actions/result"
import { allowAttempt, isRateLimited } from "@/server/rate-limit"
import { headers } from "next/headers"
import { LicenseError, looksLikeLicenseCode, redeemLicense } from "@/server/licenses"

const codeSchema = z.string().trim().toUpperCase().min(3).max(30)

class CouponError extends Error {}

/** Canjea un código de descuento para el negocio activo (dueño o administrador). */
export async function redeemCoupon(rawCode: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = codeSchema.safeParse(rawCode)
  if (!parsed.success) return { ok: false, message: "Escribe el código tal como te llegó." }
  const code = parsed.data

  if (looksLikeLicenseCode(code)) return redeemActivationCode(ctx, code)

  try {
    assertCan(ctx, "settings:manage")
    // Evita probar miles de códigos hasta adivinar uno: máximo 10 intentos por hora por negocio.
    if (!(await allowAttempt(`cupon:${ctx.businessId}`, 10, 60 * 60 * 1000))) {
      return { ok: false, message: "Probaste muchos códigos seguidos. Espera una hora e intenta de nuevo." }
    }

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

const HOUR = 60 * 60 * 1000
/** Intentos fallidos de canje permitidos por hora: por cuenta y por conexión (IP). */
const MAX_FAILS_USER = 5
const MAX_FAILS_IP = 20

/** Código de activación del Plan Pro permanente (OS-PRO-XXXX-XXXX). Solo el dueño de la cuenta. */
async function redeemActivationCode(ctx: Awaited<ReturnType<typeof requireBusiness>>, code: string): Promise<ActionResult> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip"
  const userKey = `canje-codigo:u:${ctx.user.id}`
  const ipKey = `canje-codigo:ip:${ip}`
  try {
    if ((await isRateLimited(userKey, MAX_FAILS_USER, HOUR)) || (await isRateLimited(ipKey, MAX_FAILS_IP, HOUR))) {
      return { ok: false, message: "Probaste muchos códigos que no sirven. Espera una hora e intenta de nuevo." }
    }
    if (ctx.role !== "OWNER") return { ok: false, message: "Solo el dueño de la cuenta puede canjear este código." }
    const r = await redeemLicense({ userId: ctx.user.id, email: ctx.user.email, businessId: ctx.businessId, rawCode: code })
    revalidatePath("/dashboard", "layout")
    return {
      ok: true,
      message: `¡Listo! Tu cuenta ya tiene el Plan Pro permanente, sin vencimiento ni cobros mensuales.${r.businesses > 1 ? " También quedaron en Pro tus sucursales." : ""}${r.cancelledSubscriptions ? " Cancelamos tu suscripción mensual: no se te cobrará más." : ""}`,
    }
  } catch (error) {
    if (error instanceof LicenseError) {
      await allowAttempt(userKey, Number.MAX_SAFE_INTEGER, HOUR)
      await allowAttempt(ipKey, Number.MAX_SAFE_INTEGER, HOUR)
      return { ok: false, message: error.message }
    }
    return toActionError(error)
  }
}
