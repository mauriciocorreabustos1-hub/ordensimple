import "server-only"
import { db } from "@/lib/db"
import { addDays, startOfDay, toDateKey } from "@/lib/dates"

const TZ = "America/Santiago"
export const ADMIN_PAGE_SIZE = 50

export async function getAdminStats(now = new Date()) {
  const today = startOfDay(now, TZ)
  const d7 = addDays(today, -6, TZ)
  const d30 = addDays(today, -29, TZ)
  const d14 = addDays(today, -13, TZ)

  const [users, users7, users30, businesses, sales, expenses, products, active7, active30, recentSignups] =
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
    signupsByDay,
  }
}

export async function listAdminUsers({ q, page }: { q?: string; page: number }) {
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
        memberships: {
          select: {
            role: true,
            business: {
              select: {
                id: true,
                name: true,
                planExpiresAt: true,
                discountPercent: true,
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
