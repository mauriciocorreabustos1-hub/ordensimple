import "server-only"
import { getAppUrl } from "@/lib/app-url"
import { db } from "@/lib/db"
import { getPreapproval, setPreapprovalStatus } from "@/lib/mercadopago"
import { effectivePlan, PLAN_RANK } from "@/lib/plans"

/** Días extra después del período pagado, por si el cobro del mes se atrasa o se reintenta. */
const GRACE_DAYS = 3
const DAY = 86_400_000

function addMonth(date: Date) {
  const d = new Date(date)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

/** Dirección pública a la que Mercado Pago devuelve después de pagar (no acepta localhost). */
export function subscriptionBackUrl() {
  const base = getAppUrl().startsWith("https://") ? getAppUrl() : "https://www.ordensimple.cl"
  return `${base}/dashboard/configuracion/suscripcion`
}

/**
 * Trae el estado real de una suscripción desde Mercado Pago y actualiza el plan del negocio.
 * - Cada cobro aprobado deja el plan vigente un mes más (+ días de gracia).
 * - Recién autorizada y sin cobro aún: unos días de plan mientras Mercado Pago cobra.
 * - Cancelada o pausada: no se quita nada; el plan vence solo al final de lo pagado.
 * Nunca se confía en lo que llega en una notificación: siempre se consulta a la API.
 */
export async function syncSubscription(externalId: string, opts: { chargedAt?: Date; coverUntilNext?: boolean } = {}) {
  const sub = await db.subscription.findUnique({ where: { externalId } })
  if (!sub) return null
  const pre = await getPreapproval(externalId)
  // La suscripción tiene que ser de este negocio.
  if (pre.external_reference !== sub.businessId) return null

  const summaryCharge = pre.summarized?.last_charged_date ? new Date(pre.summarized.last_charged_date) : null
  const charges = [summaryCharge, opts.chargedAt ?? null, sub.lastChargedAt].filter((d): d is Date =>
    Boolean(d && !Number.isNaN(d.getTime())),
  )
  const lastChargedAt = charges.length ? new Date(Math.max(...charges.map((d) => d.getTime()))) : null
  const nextPaymentAt = pre.next_payment_date ? new Date(pre.next_payment_date) : null

  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: {
      status: pre.status,
      lastChargedAt,
      nextPaymentAt,
      checkoutUrl: pre.status === "pending" ? (pre.init_point ?? sub.checkoutUrl) : null,
    },
  })

  let until: Date | null = null
  if (lastChargedAt) until = new Date(addMonth(lastChargedAt).getTime() + GRACE_DAYS * DAY)
  if (pre.status === "authorized" && !lastChargedAt) until = new Date(Date.now() + GRACE_DAYS * DAY)
  // Al reanudar después de un regalo: el plan cubre hasta el próximo cobro, aunque Mercado Pago lo agende más adelante.
  if (opts.coverUntilNext && pre.status === "authorized" && nextPaymentAt) {
    const toNext = new Date(nextPaymentAt.getTime() + GRACE_DAYS * DAY)
    if (!until || toNext > until) until = toNext
  }

  if (until) {
    const business = await db.business.findUnique({ where: { id: sub.businessId }, select: { plan: true, planExpiresAt: true } })
    if (business) {
      const current = effectivePlan(business)
      // No se toca un plan mayor ni uno regalado sin fecha de término.
      const higher = PLAN_RANK[current] > PLAN_RANK[sub.plan]
      const forever = current === sub.plan && !business.planExpiresAt
      if (!higher && !forever) {
        const keep = current === sub.plan && business.planExpiresAt && business.planExpiresAt > until ? business.planExpiresAt : until
        await db.business.update({ where: { id: sub.businessId }, data: { plan: sub.plan, planExpiresAt: keep } })
      }
    }
  }
  return updated
}

/**
 * "Invita a un amigo": quien paga suscripción y gana días no debería pagar durante esos días.
 * Se pausa su cobro en Mercado Pago hasta que se acaban (menos los días de gracia) y la tarea diaria lo reanuda.
 * No se toca una suscripción que la persona pausó por su cuenta.
 */
export async function pauseForGift(businessId: string, planExpiresAt: Date, now = new Date()) {
  const sub = await db.subscription.findFirst({
    where: { businessId, OR: [{ status: "authorized" }, { status: "paused", giftPausedUntil: { not: null } }] },
    orderBy: { createdAt: "desc" },
  })
  if (!sub) return { state: "none" as const }
  const resumeAt = new Date(planExpiresAt.getTime() - GRACE_DAYS * DAY)
  if (resumeAt <= now) return { state: "none" as const }
  try {
    if (sub.status === "authorized") await setPreapprovalStatus(sub.externalId, "paused")
    await db.subscription.update({ where: { id: sub.id }, data: { status: "paused", giftPausedUntil: resumeAt } })
    return { state: "paused" as const, resumeAt }
  } catch (error) {
    console.error("[invita] No se pudo pausar el cobro en Mercado Pago:", error)
    return { state: "error" as const }
  }
}

/** Tarea diaria: reanuda los cobros pausados como regalo cuando se acaban los días. */
export async function resumeGiftPauses(now = new Date()) {
  const due = await db.subscription.findMany({ where: { giftPausedUntil: { lte: now } } })
  let resumed = 0
  for (const sub of due) {
    try {
      // Si la persona la canceló mientras tanto, no se reanuda.
      if (sub.status === "paused") {
        await setPreapprovalStatus(sub.externalId, "authorized")
        resumed++
      }
      await db.subscription.update({ where: { id: sub.id }, data: { giftPausedUntil: null } })
      await syncSubscription(sub.externalId, { coverUntilNext: true })
    } catch (error) {
      // Queda pendiente y se reintenta mañana (el plan tiene días de gracia).
      console.error("[invita] No se pudo reanudar el cobro:", error)
    }
  }
  return { resumed }
}
