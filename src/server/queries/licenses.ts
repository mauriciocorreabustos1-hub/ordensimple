import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import type { ActivationCodeStatus } from "@/generated/prisma/enums"
import { db } from "@/lib/db"
import { licenseItemIds, mercadoLibreAccount, mercadoLibreConfigured } from "@/server/mercadolibre"

export const LICENSE_FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "disponible", label: "Disponibles" },
  { value: "reservado", label: "Reservados" },
  { value: "usado", label: "Usados" },
  { value: "anulado", label: "Anulados" },
] as const

export type LicenseFilter = (typeof LICENSE_FILTERS)[number]["value"]

const STATUS_OF: Record<Exclude<LicenseFilter, "todos">, ActivationCodeStatus> = {
  disponible: "AVAILABLE",
  reservado: "RESERVED",
  usado: "USED",
  anulado: "VOID",
}

/** Todo lo de la sección Códigos del panel. */
export async function getLicenseAdmin({ filter, q }: { filter: LicenseFilter; q: string }) {
  const search = q.trim().toUpperCase()
  const where: Prisma.ActivationCodeWhereInput = {
    ...(filter !== "todos" ? { status: STATUS_OF[filter] } : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search } },
            { mlOrderId: { contains: search } },
            { redeemedByEmail: { contains: q.trim().toLowerCase() } },
            { note: { contains: q.trim(), mode: "insensitive" } },
          ],
        }
      : {}),
  }
  const [counts, codes, matching, review, waiting, unsent, logs, account] = await Promise.all([
    db.activationCode.groupBy({ by: ["status"], _count: true }),
    db.activationCode.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    db.activationCode.count({ where }),
    db.mlOrder.findMany({ where: { reviewReason: { not: null }, reviewedAt: null }, orderBy: { updatedAt: "desc" }, take: 30 }),
    db.mlOrder.findMany({ where: { pendingUnits: { gt: 0 }, reviewReason: null }, orderBy: { updatedAt: "desc" }, take: 30 }),
    db.activationCode.findMany({ where: { status: "RESERVED", sentAt: null, mlOrderId: { not: null } }, orderBy: { reservedAt: "asc" }, take: 30 }),
    db.licenseLog.findMany({ orderBy: { createdAt: "desc" }, take: 60 }),
    mercadoLibreAccount(),
  ])
  const reviewCodes = review.length
    ? await db.activationCode.findMany({ where: { mlOrderId: { in: review.map((o) => o.id) }, status: { not: "VOID" } }, select: { id: true, code: true, status: true, mlOrderId: true } })
    : []
  const count = (s: ActivationCodeStatus) => counts.find((c) => c.status === s)?._count ?? 0
  return {
    counts: { available: count("AVAILABLE"), reserved: count("RESERVED"), used: count("USED"), void: count("VOID") },
    codes,
    matching,
    review: review.map((o) => ({ ...o, codes: reviewCodes.filter((c) => c.mlOrderId === o.id) })),
    waiting,
    unsent,
    logs,
    ml: { configured: mercadoLibreConfigured(), items: licenseItemIds(), account },
  }
}
