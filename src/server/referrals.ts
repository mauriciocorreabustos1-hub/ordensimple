import "server-only"
import { Prisma } from "@/generated/prisma/client"
import type { Plan } from "@/generated/prisma/enums"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { referralRewardEmail } from "@/lib/email-templates"
import { effectivePlan, PLAN_RANK, PLANS } from "@/lib/plans"
import { REFERRAL_CODE_RE } from "@/lib/referrals"

const DAY = 86_400_000

/** Reglas del programa (si no existen todavía, se crean con los valores por defecto). */
export async function getReferralProgram() {
  const found = await db.referralProgram.findUnique({ where: { id: "default" } })
  return found ?? db.referralProgram.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} })
}

/** Código del enlace de invitación del negocio (se crea la primera vez): "donpedro-k7m2". */
export async function referralCodeFor(businessId: string) {
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, referralCode: true } })
  if (business.referralCode) return business.referralCode
  const base =
    business.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 12) || "negocio"
  const letters = "abcdefghjkmnpqrstuvwxyz23456789"
  for (let i = 0; i < 5; i++) {
    const tail = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("")
    const code = `${base}-${tail}`
    // Que no choque con un enlace especial del administrador.
    if (await db.specialLink.findUnique({ where: { code }, select: { id: true } })) continue
    try {
      // Si otra pestaña ya le creó un código, se respeta ese.
      const { count } = await db.business.updateMany({ where: { id: businessId, referralCode: null }, data: { referralCode: code } })
      if (count) return code
      return (await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { referralCode: true } })).referralCode!
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error
    }
  }
  throw new Error("No se pudo crear el código de invitación")
}

/** Enlace especial del administrador, si existe y todavía se puede usar (activo, sin vencer y con cupos). */
export async function findSpecialLink(code: string | null | undefined, now = new Date()) {
  if (!code || !REFERRAL_CODE_RE.test(code)) return null
  const link = await db.specialLink.findUnique({ where: { code }, include: { _count: { select: { uses: true } } } })
  if (!link || !link.active) return null
  if (link.expiresAt && link.expiresAt <= now) return null
  if (link.maxUses !== null && link._count.uses >= link.maxUses) return null
  return link
}

export function findReferrerByCode(code: string | null | undefined) {
  if (!code || !REFERRAL_CODE_RE.test(code)) return Promise.resolve(null)
  return db.business.findUnique({ where: { referralCode: code }, select: { id: true, name: true } })
}

/**
 * Regala días de un plan. Si ya tiene ese plan con fecha, se suman al final; si tiene un plan mayor
 * o uno sin vencimiento, no se toca y se explica por qué.
 */
async function grantPlanDays(businessId: string, plan: Plan, days: number, now: Date) {
  if (days <= 0) return { days: 0, until: null, note: "El programa regala 0 días" }
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { plan: true, planExpiresAt: true, subscriptions: { where: { status: "authorized" }, select: { id: true }, take: 1 } },
  })
  if (!business) return { days: 0, until: null, note: "El negocio ya no existe" }
  const current = effectivePlan(business, now)
  if (PLAN_RANK[current] > PLAN_RANK[plan]) return { days: 0, until: null, note: `Ya tenía el plan ${PLANS[current].name}` }
  if (current === plan && !business.planExpiresAt)
    return { days: 0, until: null, note: `Ya tenía el plan ${PLANS[plan].name} sin vencimiento` }
  const base = current === plan && business.planExpiresAt && business.planExpiresAt > now ? business.planExpiresAt : now
  const until = new Date(base.getTime() + days * DAY)
  await db.business.update({ where: { id: businessId }, data: { plan, planExpiresAt: until } })
  const note = business.subscriptions.length ? "Paga suscripción: los días se sumaron, pero Mercado Pago le sigue cobrando" : null
  return { days, until, note }
}

/** Le da su recompensa a quien invitó (una sola vez por invitado, y hasta el máximo del programa). */
async function rewardReferrer(referralId: string, program: Awaited<ReturnType<typeof getReferralProgram>>, now: Date) {
  // Se "reserva" primero: si dos procesos corren a la vez, solo uno la entrega.
  const { count } = await db.referral.updateMany({ where: { id: referralId, referrerRewardedAt: null }, data: { referrerRewardedAt: now } })
  if (!count) return false
  const referral = await db.referral.findUniqueOrThrow({
    where: { id: referralId },
    select: { referrerBusinessId: true, referred: { select: { name: true } } },
  })
  const earned = await db.referral.count({
    where: { referrerBusinessId: referral.referrerBusinessId, referrerDays: { gt: 0 }, id: { not: referralId } },
  })
  if (program.maxRewards !== null && earned >= program.maxRewards) {
    await db.referral.update({
      where: { id: referralId },
      data: { referrerDays: 0, referrerNote: `Ya ganó el máximo de ${program.maxRewards} recompensas` },
    })
    return false
  }
  const result = await grantPlanDays(referral.referrerBusinessId, program.plan, program.referrerDays, now)
  await db.referral.update({ where: { id: referralId }, data: { referrerDays: result.days, referrerNote: result.note } })
  if (result.days > 0 && result.until) {
    const owners = await db.businessMember.findMany({
      where: { businessId: referral.referrerBusinessId, role: "OWNER" },
      select: { user: { select: { name: true, email: true } } },
    })
    for (const { user } of owners) {
      const email = referralRewardEmail({
        name: user.name,
        invitedName: referral.referred.name,
        planName: PLANS[program.plan].name,
        days: result.days,
        expiresAt: result.until,
      })
      await sendEmail({ to: user.email, ...email }).catch((error) => console.error("[invita] No se pudo avisar la recompensa:", error))
    }
  }
  return result.days > 0
}

/**
 * Al terminar de crear su negocio: si llegó con un enlace de invitación, queda registrado,
 * recibe sus días de regalo y, si el programa lo dice, quien invitó gana al tiro.
 */
export async function recordReferral({ userId, businessId, now = new Date() }: { userId: string; businessId: string; now?: Date }) {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { invitedByCode: true } })
    // Enlace especial del administrador (campañas): solo da días al nuevo negocio.
    const special = await findSpecialLink(user?.invitedByCode, now)
    if (special) {
      const use = await db.specialLinkUse.create({ data: { linkId: special.id, businessId, userId } })
      const gift = await grantPlanDays(businessId, special.plan, special.days, now)
      await db.specialLinkUse.update({ where: { id: use.id }, data: { days: gift.days, note: gift.note } })
      return
    }
    const referrer = await findReferrerByCode(user?.invitedByCode)
    if (!referrer || referrer.id === businessId) return
    const program = await getReferralProgram()
    if (!program.enabled) return
    // No vale invitarse a uno mismo (por ejemplo, el dueño creando otra cuenta en su propio negocio).
    const ownMember = await db.businessMember.findFirst({ where: { businessId: referrer.id, userId }, select: { id: true } })
    if (ownMember) return

    const referral = await db.referral.create({
      data: { referrerBusinessId: referrer.id, referredBusinessId: businessId, referredUserId: userId },
    })
    const gift = await grantPlanDays(businessId, program.plan, program.invitedDays, now)
    await db.referral.update({ where: { id: referral.id }, data: { invitedDays: gift.days, invitedNote: gift.note } })
    if (program.referrerTrigger === "REGISTRO") await rewardReferrer(referral.id, program, now)
  } catch (error) {
    // Nunca debe impedir que la persona termine de crear su negocio.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return
    console.error("[invita] No se pudo registrar la invitación:", error)
  }
}

/** Tarea diaria: entrega las recompensas pendientes de quienes invitaron (según las reglas actuales). */
export async function processReferralRewards(now = new Date()) {
  const program = await getReferralProgram()
  if (!program.enabled) return { rewarded: 0 }
  const pending = await db.referral.findMany({
    where: { referrerRewardedAt: null },
    select: {
      id: true,
      referred: {
        select: {
          _count: { select: { sales: true } },
          subscriptions: { where: { lastChargedAt: { not: null } }, select: { id: true }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 300,
  })
  let rewarded = 0
  for (const r of pending) {
    const ready =
      program.referrerTrigger === "REGISTRO" ||
      (program.referrerTrigger === "VENTAS" && r.referred._count.sales >= program.minSales) ||
      (program.referrerTrigger === "PAGO" && r.referred.subscriptions.length > 0)
    if (ready && (await rewardReferrer(r.id, program, now))) rewarded++
  }
  return { rewarded }
}

/** Para la página "Invita y gana" del negocio. */
export async function getReferralOverview(businessId: string) {
  // El código va primero: si hay que crearlo, es una escritura y conviene que no compita con las lecturas.
  const code = await referralCodeFor(businessId)
  const [program, referrals] = await Promise.all([
    getReferralProgram(),
    db.referral.findMany({
      where: { referrerBusinessId: businessId },
      select: {
        id: true,
        createdAt: true,
        referrerRewardedAt: true,
        referrerDays: true,
        referred: { select: { name: true, _count: { select: { sales: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])
  return { program, code, referrals }
}

/** Para el panel de administración: reglas, totales y últimas invitaciones. */
export async function getReferralAdmin() {
  const [program, total, rewarded, daysGiven, recent] = await Promise.all([
    getReferralProgram(),
    db.referral.count(),
    db.referral.count({ where: { referrerDays: { gt: 0 } } }),
    db.referral.aggregate({ _sum: { referrerDays: true, invitedDays: true } }),
    db.referral.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        invitedDays: true,
        invitedNote: true,
        referrerRewardedAt: true,
        referrerDays: true,
        referrerNote: true,
        referrer: { select: { name: true } },
        referred: { select: { name: true, _count: { select: { sales: true } } } },
      },
    }),
  ])
  return {
    program,
    total,
    rewarded,
    pending: await db.referral.count({ where: { referrerRewardedAt: null } }),
    days: (daysGiven._sum.referrerDays ?? 0) + (daysGiven._sum.invitedDays ?? 0),
    recent,
  }
}

/** Enlaces especiales para el panel: cuántos se registraron, cuántos crearon su negocio y cuántos ya pagan. */
export async function getSpecialLinksAdmin() {
  const links = await db.specialLink.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { uses: true } } } })
  if (!links.length) return []
  const codes = links.map((l) => l.code)
  const [signups, paying] = await Promise.all([
    db.user.groupBy({ by: ["invitedByCode"], where: { invitedByCode: { in: codes } }, _count: true }),
    db.specialLinkUse.findMany({
      where: { linkId: { in: links.map((l) => l.id) }, business: { subscriptions: { some: { lastChargedAt: { not: null } } } } },
      select: { linkId: true },
    }),
  ])
  return links.map((l) => ({
    ...l,
    signups: signups.find((s) => s.invitedByCode === l.code)?._count ?? 0,
    businesses: l._count.uses,
    paying: paying.filter((p) => p.linkId === l.id).length,
  }))
}
