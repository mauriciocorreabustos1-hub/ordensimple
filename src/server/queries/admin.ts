import "server-only"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { addDays, startOfDay, toDateKey } from "@/lib/dates"

const TZ = "America/Santiago"
export const ADMIN_PAGE_SIZE = 50

export async function getAdminStats(now = new Date()) {
  const today = startOfDay(now, TZ)
  const d7 = addDays(today, -6, TZ)
  const d30 = addDays(today, -29, TZ)
  const d14 = addDays(today, -13, TZ)

  const [users, users7, users30, businesses, sales, expenses, products, active7, active30, recentSignups, usedToday, used7, used30] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: d7 } } }),
      db.user.count({ where: { createdAt: { gte: d30 } } }),
      db.business.count({ where: { onboardingCompleted: true } }),
      db.sale.count(),
      db.expense.count(),
      db.product.count(),
      db.sale.groupBy({ by: ["businessId"], where: { createdAt: { gte: d7 } } }),
      db.sale.groupBy({ by: ["businessId"], where: { createdAt: { gte: d30 } } }),
      db.user.findMany({ where: { createdAt: { gte: d14 } }, select: { createdAt: true } }),
      db.user.count({ where: { lastActiveAt: { gte: today } } }),
      db.user.count({ where: { lastActiveAt: { gte: d7 } } }),
      db.user.count({ where: { lastActiveAt: { gte: d30 } } }),
    ])

  // Registros por día (últimos 14 días)
  const counts = new Map<string, number>()
  for (const u of recentSignups) {
    const key = toDateKey(u.createdAt, TZ)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const signupsByDay = Array.from({ length: 14 }, (_, i) => {
    const day = addDays(d14, i, TZ)
    const key = toDateKey(day, TZ)
    return { key, day, count: counts.get(key) ?? 0 }
  })

  return {
    users,
    users7,
    users30,
    businesses,
    sales,
    expenses,
    products,
    active7: active7.length,
    active30: active30.length,
    /** Personas que entraron a la app hoy, en 7 y en 30 días. */
    usedToday,
    used7,
    used30,
    signupsByDay,
  }
}

export const ACTIVITY_FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "hoy", label: "Activos hoy" },
  { value: "semana", label: "Activos 7 días" },
  { value: "inactivos", label: "Sin entrar hace 14+ días" },
] as const
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number]["value"]

export const ROLE_FILTERS = [
  { value: "todos", label: "Todos los roles" },
  { value: "OWNER", label: "Dueños" },
  { value: "ADMIN", label: "Administradores" },
  { value: "EMPLOYEE", label: "Empleados" },
  { value: "ninguno", label: "Sin negocio" },
] as const
export type RoleFilter = (typeof ROLE_FILTERS)[number]["value"]

const roleWhere = (role: RoleFilter) =>
  role === "ninguno" ? { memberships: { none: {} } } : role === "todos" ? {} : { memberships: { some: { role } } }

/** Cuántas cuentas hay de cada rol (una persona con varios negocios cuenta en cada rol que tenga). */
export async function countUsersByRole() {
  const roles = ROLE_FILTERS.filter((r) => r.value !== "todos")
  const counts = await Promise.all(roles.map((r) => db.user.count({ where: roleWhere(r.value) })))
  return Object.fromEntries(roles.map((r, i) => [r.value, counts[i]])) as Record<Exclude<RoleFilter, "todos">, number>
}

export async function listAdminUsers({
  q,
  page,
  activity = "todos",
  role = "todos",
  all = false,
}: {
  q?: string
  page: number
  activity?: ActivityFilter
  role?: RoleFilter
  /** Todos los que coinciden, sin páginas (para descargar). */
  all?: boolean
}) {
  const today = startOfDay(new Date(), TZ)
  const byActivity =
    activity === "hoy"
      ? { lastActiveAt: { gte: today } }
      : activity === "semana"
        ? { lastActiveAt: { gte: addDays(today, -6, TZ) } }
        : activity === "inactivos"
          ? { OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: addDays(today, -13, TZ) } }] }
          : {}
  const where = {
    AND: [
      q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
      byActivity,
      roleWhere(role),
    ],
  }

  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: activity === "todos" ? { createdAt: "desc" } : { lastActiveAt: { sort: "desc", nulls: "last" } },
      skip: all ? 0 : (page - 1) * ADMIN_PAGE_SIZE,
      take: all ? 10_000 : ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        marketingOptIn: true,
        signupSource: true,
        signupCampaign: true,
        lastActiveAt: true,
        _count: { select: { adminNotes: true } },
        sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true, userAgent: true } },
        memberships: {
          select: {
            role: true,
            business: {
              select: {
                id: true,
                name: true,
                planExpiresAt: true,
                discountPercent: true,
                extraProducts: true,
                extraMembers: true,
                type: true,
                plan: true,
                onboardingCompleted: true,
                _count: { select: { sales: true, expenses: true, products: true, members: true } },
              },
            },
          },
        },
      },
    }),
  ])

  return { total, rows, pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) }
}

export type AdminUserRow = Awaited<ReturnType<typeof listAdminUsers>>["rows"][number]

export type BusinessActivity = {
  lastSaleAt: Date | null
  sales30: number
  total30: number
  /** Días distintos con ventas en los últimos 30 días. */
  days30: number
  bestProduct: { name: string; revenue: number; qty: number } | null
}

/** Cómo usa la app cada negocio: última venta, ventas de los últimos 30 días y su producto estrella (90 días). */
export async function getBusinessActivity(businessIds: string[]) {
  const out = new Map<string, BusinessActivity>()
  if (!businessIds.length) return out
  const today = startOfDay(new Date(), TZ)
  const d30 = addDays(today, -29, TZ)
  const d90 = addDays(today, -89, TZ)
  const [last, recent, best] = await Promise.all([
    db.sale.groupBy({ by: ["businessId"], where: { businessId: { in: businessIds } }, _max: { date: true } }),
    db.$queryRaw<{ businessId: string; sales: bigint; total: bigint | null; days: bigint }[]>`
      SELECT "businessId", COUNT(*) AS sales, SUM("total") AS total,
             COUNT(DISTINCT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD')) AS days
      FROM "sale"
      WHERE "businessId" IN (${Prisma.join(businessIds)}) AND "date" >= ${d30}
      GROUP BY "businessId"`,
    db.$queryRaw<{ businessId: string; name: string; revenue: bigint; qty: bigint }[]>`
      SELECT DISTINCT ON (s."businessId") s."businessId", i."description" AS name, SUM(i."subtotal") AS revenue, SUM(i."quantity") AS qty
      FROM "sale_item" i JOIN "sale" s ON s."id" = i."saleId"
      WHERE s."businessId" IN (${Prisma.join(businessIds)}) AND s."date" >= ${d90} AND i."productId" IS NOT NULL
      GROUP BY s."businessId", i."description"
      ORDER BY s."businessId", SUM(i."subtotal") DESC`,
  ])
  for (const id of businessIds) out.set(id, { lastSaleAt: null, sales30: 0, total30: 0, days30: 0, bestProduct: null })
  for (const r of last) out.get(r.businessId)!.lastSaleAt = r._max.date
  for (const r of recent) Object.assign(out.get(r.businessId)!, { sales30: Number(r.sales), total30: Number(r.total ?? 0), days30: Number(r.days) })
  for (const r of best) out.get(r.businessId)!.bestProduct = { name: r.name, revenue: Number(r.revenue), qty: Number(r.qty) }
  return out
}

export async function getRecentErrors() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [rows, last24, total] = await Promise.all([
    db.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.errorLog.count({ where: { createdAt: { gte: dayAgo } } }),
    db.errorLog.count(),
  ])
  return { rows, last24, total }
}

export async function listCoupons() {
  return db.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  })
}

/** Negocios con plan Pro o Empresa (vigente o vencido), para el resumen de suscripciones. */
export async function getPlanCounts(now = new Date()) {
  const [pro, business, expired] = await Promise.all([
    db.business.count({ where: { plan: "PRO", OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }] } }),
    db.business.count({ where: { plan: "BUSINESS", OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }] } }),
    db.business.count({ where: { plan: { not: "FREE" }, planExpiresAt: { lte: now } } }),
  ])
  return { pro, business, expired }
}
