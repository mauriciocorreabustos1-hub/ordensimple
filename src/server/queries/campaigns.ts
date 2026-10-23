import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { BUSINESS_TYPES } from "@/lib/constants"

export const AUDIENCES = {
  ALL: "Todos los que aceptan ofertas",
  FREE: "Solo plan Gratis",
  PAID: "Solo Pro o Empresa",
} as const

export type Audience = keyof typeof AUDIENCES

/** Rubros para filtrar envíos: los de la lista, y "Otro" para los que escribieron su rubro a mano. */
export const CAMPAIGN_RUBROS = BUSINESS_TYPES
const KNOWN_RUBROS = BUSINESS_TYPES.filter((t) => t !== "Otro")

/** Negocios que escribieron un rubro a mano (aunque también hayan marcado alguno de la lista). */
async function customRubroBusinessIds() {
  const rows = await db.business.findMany({ where: { type: { not: null } }, select: { id: true, type: true } })
  return rows
    .filter((b) =>
      (b.type ?? "")
        .split("·")
        .map((p) => p.trim())
        .some((p) => p && p !== "Otro" && !KNOWN_RUBROS.includes(p)),
    )
    .map((b) => b.id)
}

/**
 * Negocios de alguno de esos rubros. Los rubros se guardan juntos en un texto ("Almacén o minimarket · Botillería"),
 * así que se busca cada uno dentro. "Otro": los que escribieron su rubro a mano.
 */
async function rubroWhere(rubros: string[]): Promise<Prisma.BusinessWhereInput> {
  const custom = rubros.includes("Otro") ? await customRubroBusinessIds() : []
  return { OR: rubros.map((r) => (r === "Otro" ? { id: { in: custom } } : { type: { contains: r } })) }
}

/** Solo personas que aceptaron recibir ofertas (marketingOptIn), del plan y de los rubros elegidos (vacío: todos). */
export async function audienceWhere(audience: Audience, rubros: string[] = [], now = new Date()): Promise<Prisma.UserWhereInput> {
  const paid: Prisma.BusinessWhereInput = {
    plan: { not: "FREE" },
    OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }],
  }
  const byPlan: Prisma.UserWhereInput =
    audience === "PAID"
      ? { memberships: { some: { business: paid } } }
      : audience === "FREE"
        ? { NOT: { memberships: { some: { business: paid } } } }
        : {}
  return {
    marketingOptIn: true,
    AND: [byPlan, ...(rubros.length ? [{ memberships: { some: { business: await rubroWhere(rubros) } } }] : [])],
  }
}

export async function getAudienceCounts() {
  const [ALL, FREE, PAID, totalUsers, byRubro] = await Promise.all([
    countAudience("ALL", []),
    countAudience("FREE", []),
    countAudience("PAID", []),
    db.user.count(),
    Promise.all(CAMPAIGN_RUBROS.map((r) => countAudience("ALL", [r]))),
  ])
  return {
    counts: { ALL, FREE, PAID } satisfies Record<Audience, number>,
    totalUsers,
    rubros: CAMPAIGN_RUBROS.map((value, i) => ({ value, count: byRubro[i] })),
  }
}

/** Cuántas personas recibirían un envío con ese plan y esos rubros. */
export async function countAudience(audience: Audience, rubros: string[]) {
  return db.user.count({ where: await audienceWhere(audience, rubros) })
}

export async function listCampaigns() {
  return db.emailCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 20 })
}
