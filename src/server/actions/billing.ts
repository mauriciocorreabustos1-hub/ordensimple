"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { cancelPreapproval, createPreapproval, MercadoPagoError, mercadoPagoConfigured } from "@/lib/mercadopago"
import { BILLING_ENABLED, discountedPrice, PAID_PLANS, PLANS } from "@/lib/plans"
import { subscriptionBackUrl, syncSubscription } from "@/server/billing"
import { requireBusiness } from "@/server/session"
import { toActionError, type ActionResult } from "@/server/actions/result"
import { recordError } from "@/server/error-log"

const subscribeSchema = z.object({
  payerEmail: z.email("Escribe el correo de tu cuenta de Mercado Pago").trim().toLowerCase().max(200),
  plan: z.enum(PAID_PLANS),
})

function mpMessage(error: unknown) {
  if (error instanceof MercadoPagoError) {
    if (/different site/i.test(error.message)) return "Ese correo es de una cuenta de Mercado Pago de otro país. Usa tu cuenta de Chile."
    if (/bad request|payer/i.test(error.message)) return "Mercado Pago no reconoce ese correo. Escribe el correo con el que entras a Mercado Pago."
    return "Mercado Pago no respondió bien. Intenta de nuevo en unos minutos."
  }
  return null
}

/** Crea la suscripción mensual (Pro o Empresa) y devuelve el enlace de pago de Mercado Pago. */
export async function startSubscription(input: z.input<typeof subscribeSchema>): Promise<ActionResult<{ url: string }>> {
  const ctx = await requireBusiness()
  const parsed = subscribeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Correo inválido." }

  try {
    if (!BILLING_ENABLED || !mercadoPagoConfigured()) return { ok: false, message: "Las suscripciones todavía no están disponibles." }
    if (ctx.role !== "OWNER") return { ok: false, message: "Solo el dueño del negocio puede contratar un plan." }
    if (ctx.business.licenseCodeId && ctx.business.plan === "PRO") return { ok: false, message: "Tu cuenta ya tiene el Plan Pro permanente: no necesitas una suscripción." }
    if (ctx.business.currency !== "CLP") return { ok: false, message: "Por ahora las suscripciones son solo en pesos chilenos." }
    const plan = parsed.data.plan
    const price = PLANS[plan].monthlyPrice
    if (!price) return { ok: false, message: "Este plan aún no se puede contratar." }

    const existing = await db.subscription.findMany({
      where: { businessId: ctx.businessId, status: { in: ["authorized", "pending", "paused"] } },
      orderBy: { createdAt: "desc" },
    })
    const active = existing.find((s) => s.status === "authorized" || s.status === "paused")
    if (active) {
      return {
        ok: false,
        message:
          active.plan === plan
            ? "Ya tienes una suscripción activa a este plan."
            : `Ya pagas el plan ${PLANS[active.plan].name}. Cancélalo primero para cambiarte de plan.`,
      }
    }
    const pending = existing.find((s) => s.status === "pending" && s.plan === plan && s.payerEmail === parsed.data.payerEmail && s.checkoutUrl)
    if (pending?.checkoutUrl) return { ok: true, data: { url: pending.checkoutUrl } }

    const amount = discountedPrice(price, ctx.business.discountPercent)
    const pre = await createPreapproval({
      reason: `OrdenSimple ${PLANS[plan].name} · ${ctx.business.name}`.slice(0, 120),
      externalReference: ctx.businessId,
      payerEmail: parsed.data.payerEmail,
      amount,
      currency: "CLP",
      backUrl: subscriptionBackUrl(),
    })
    if (!pre.init_point) return { ok: false, message: "Mercado Pago no entregó el enlace de pago. Intenta de nuevo." }

    await db.subscription.create({
      data: {
        businessId: ctx.businessId,
        userId: ctx.user.id,
        plan,
        externalId: pre.id,
        status: pre.status,
        amount,
        currency: "CLP",
        payerEmail: parsed.data.payerEmail,
        checkoutUrl: pre.init_point,
      },
    })
    return { ok: true, data: { url: pre.init_point } }
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      await recordError({ source: "servidor", message: `No se pudo crear el pago con cuenta de Mercado Pago: ${error.status} — ${error.message}`, path: "/dashboard/plan" })
    }
    const message = mpMessage(error)
    return message ? { ok: false, message } : toActionError(error)
  }
}

const cardSchema = z.object({
  plan: z.enum(PAID_PLANS),
  cardToken: z.string().min(10).max(200),
  payerEmail: z.email().trim().toLowerCase().max(200),
})

/**
 * Suscripción pagando con tarjeta dentro de OrdenSimple (formulario seguro de Mercado Pago):
 * no hace falta cuenta de Mercado Pago ni salir de la página. Los datos de la tarjeta nunca llegan aquí,
 * solo un código de un solo uso que entrega Mercado Pago.
 */
export async function startCardSubscription(input: z.input<typeof cardSchema>): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = cardSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Revisa los datos de la tarjeta e intenta de nuevo." }
  const { plan, cardToken, payerEmail } = parsed.data

  try {
    if (!BILLING_ENABLED || !mercadoPagoConfigured()) return { ok: false, message: "Las suscripciones todavía no están disponibles." }
    if (ctx.role !== "OWNER") return { ok: false, message: "Solo el dueño del negocio puede contratar un plan." }
    if (ctx.business.licenseCodeId && ctx.business.plan === "PRO") return { ok: false, message: "Tu cuenta ya tiene el Plan Pro permanente: no necesitas una suscripción." }
    if (ctx.business.currency !== "CLP") return { ok: false, message: "Por ahora las suscripciones son solo en pesos chilenos." }
    const price = PLANS[plan].monthlyPrice
    if (!price) return { ok: false, message: "Este plan aún no se puede contratar." }

    const active = await db.subscription.findFirst({
      where: { businessId: ctx.businessId, status: { in: ["authorized", "paused"] } },
    })
    if (active) {
      return {
        ok: false,
        message: active.plan === plan ? "Ya tienes una suscripción activa a este plan." : `Ya pagas el plan ${PLANS[active.plan].name}. Cancélalo primero para cambiarte de plan.`,
      }
    }

    const amount = discountedPrice(price, ctx.business.discountPercent)
    const pre = await createPreapproval({
      reason: `OrdenSimple ${PLANS[plan].name} · ${ctx.business.name}`.slice(0, 120),
      externalReference: ctx.businessId,
      payerEmail,
      amount,
      currency: "CLP",
      backUrl: subscriptionBackUrl(),
      cardTokenId: cardToken,
    })

    await db.subscription.create({
      data: { businessId: ctx.businessId, userId: ctx.user.id, plan, externalId: pre.id, status: pre.status, amount, currency: "CLP", payerEmail },
    })
    // Activa el plan de inmediato; cada cobro mensual aprobado lo va renovando.
    await syncSubscription(pre.id)
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      await recordError({
        source: "servidor",
        message: `Pago con tarjeta rechazado (${PLANS[plan].name}): Mercado Pago ${error.status} — ${error.message}`,
        path: "/dashboard/plan",
      })
      // Algunas tarjetas no piden código de seguridad y Mercado Pago no las acepta para suscripciones.
      const noCvv = /cvv/i.test(error.message)
      return {
        ok: false,
        message: noCvv
          ? "Esta tarjeta no sirve para pagos mensuales. Prueba con otra tarjeta o toca “Prefiero pagar con mi cuenta de Mercado Pago”."
          : "No se pudo cobrar a esa tarjeta. Revisa los datos, prueba con otra o toca “Prefiero pagar con mi cuenta de Mercado Pago”.",
      }
    }
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: `¡Listo! Ya tienes ${PLANS[plan].name}.` }
}

/** Cancela la suscripción: no se cobra más, y Pro sigue hasta el final de lo que ya se pagó. */
export async function cancelSubscription(): Promise<ActionResult> {
  const ctx = await requireBusiness()
  try {
    if (ctx.role !== "OWNER") return { ok: false, message: "Solo el dueño del negocio puede cancelar la suscripción." }
    const sub = await db.subscription.findFirst({
      where: { businessId: ctx.businessId, status: { in: ["authorized", "paused", "pending"] } },
      orderBy: { createdAt: "desc" },
    })
    if (!sub) return { ok: false, message: "No tienes una suscripción activa." }
    await cancelPreapproval(sub.externalId)
    await syncSubscription(sub.externalId)
  } catch (error) {
    const message = mpMessage(error)
    return message ? { ok: false, message } : toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Suscripción cancelada. No se te cobrará más." }
}
