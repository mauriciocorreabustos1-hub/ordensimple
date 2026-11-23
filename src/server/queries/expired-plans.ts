import "server-only"
import { db } from "@/lib/db"

/** Tipos de correo a planes vencidos (se guardan en el historial de correos con este "público"). */
export const EXPIRED_KINDS = { aviso: "VENCIDO_AVISO", oferta: "VENCIDO_OFERTA" } as const
export type ExpiredKind = keyof typeof EXPIRED_KINDS

/** Días mínimos entre dos correos a la misma persona por su plan vencido (para no molestar). */
export const EXPIRED_COOLDOWN_DAYS = 7

/**
 * Negocios con un plan pagado o regalado que ya venció, con su dueño, si sigue usando la app y el último correo
 * que se le mandó por eso. Los más recientes primero (son los más fáciles de recuperar).
 */
export async function listExpiredPlans(now = new Date()) {
  const [rows, notices] = await Promise.all([
    db.business.findMany({
      where: { plan: { not: "FREE" }, planExpiresAt: { lte: now } },
      orderBy: { planExpiresAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        plan: true,
        planExpiresAt: true,
        _count: { select: { sales: true } },
        sales: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
        members: {
          where: { role: "OWNER" },
          take: 1,
          select: { user: { select: { id: true, name: true, email: true, marketingOptIn: true, lastActiveAt: true } } },
        },
      },
    }),
    db.emailCampaign.findMany({
      where: { audience: { in: Object.values(EXPIRED_KINDS) }, createdAt: { gte: new Date(now.getTime() - 120 * 86_400_000) } },
      orderBy: { createdAt: "desc" },
      select: { audience: true, toEmails: true, createdAt: true, couponCode: true },
    }),
  ])

  // Último aviso por correo (el historial guarda los destinatarios separados por coma).
  const last = new Map<string, { at: Date; kind: ExpiredKind; coupon: string | null }>()
  for (const n of notices) {
    for (const email of (n.toEmails ?? "").split(",").map((e) => e.trim().toLowerCase())) {
      if (email && !last.has(email)) last.set(email, { at: n.createdAt, kind: n.audience === EXPIRED_KINDS.oferta ? "oferta" : "aviso", coupon: n.couponCode })
    }
  }

  return rows.map((b) => {
    const owner = b.members[0]?.user ?? null
    return {
      id: b.id,
      name: b.name,
      plan: b.plan,
      expiredAt: b.planExpiresAt!,
      sales: b._count.sales,
      lastSaleAt: b.sales[0]?.date ?? null,
      owner,
      lastNotice: owner ? (last.get(owner.email.toLowerCase()) ?? null) : null,
    }
  })
}

export type ExpiredPlanRow = Awaited<ReturnType<typeof listExpiredPlans>>[number]
