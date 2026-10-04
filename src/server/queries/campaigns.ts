import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"

export const AUDIENCES = {
  ALL: "Todos los que aceptan ofertas",
  FREE: "Solo plan Gratis",
  PAID: "Solo Pro o Empresa",
} as const

export type Audience = keyof typeof AUDIENCES

/** Solo personas que aceptaron recibir ofertas (marketingOptIn). */
export function audienceWhere(audience: Audience, now = new Date()): Prisma.UserWhereInput {
  const paid: Prisma.BusinessWhereInput = {
    plan: { not: "FREE" },
    OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }],
  }
  if (audience === "PAID") return { marketingOptIn: true, memberships: { some: { business: paid } } }
  if (audience === "FREE") return { marketingOptIn: true, NOT: { memberships: { some: { business: paid } } } }
  return { marketingOptIn: true }
}

export async function getAudienceCounts() {
  const [ALL, FREE, PAID, totalUsers] = await Promise.all([
    db.user.count({ where: audienceWhere("ALL") }),
    db.user.count({ where: audienceWhere("FREE") }),
    db.user.count({ where: audienceWhere("PAID") }),
    db.user.count(),
  ])
  return { counts: { ALL, FREE, PAID } satisfies Record<Audience, number>, totalUsers }
}

export async function listCampaigns() {
  return db.emailCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 20 })
}
