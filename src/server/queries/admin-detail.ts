import "server-only"
import { db } from "@/lib/db"
import { addDays, formatDate, startOfDay, toDateKey } from "@/lib/dates"
import { TRACKED_FEATURES } from "@/server/feature-usage"

const TZ = "America/Santiago"

/** Funciones de la app y cómo se sabe si un negocio las usa (últimos 30 días, salvo que diga otra cosa). */
const FEATURES = [
  { key: "ventas", label: "Registrar ventas" },
  { key: "gastos", label: "Registrar gastos" },
  { key: "fiado", label: "Fiado (ventas fiadas o abonos)" },
  { key: "productos", label: "Ventas con productos (no rápidas)" },
  { key: "caja", label: "Cierre de caja (cerró la caja)" },
  { key: "inventario", label: "Movimientos de inventario" },
  { key: "merma", label: "Merma y vencidos" },
  { key: "pagos", label: "Pagos a proveedores" },
  { key: "codigos", label: "Productos con código de barras", note: "en total" },
  { key: "equipo", label: "Trabaja con equipo (2+ personas)", note: "en total" },
  ...Object.entries(TRACKED_FEATURES).map(([key, label]) => ({ key: `uso:${key}`, label, tracked: true })),
] as const

/** Cuántos negocios usan cada función: sirve para decidir qué mejorar y qué casi nadie usa. */
export async function getFeatureAdoption(now = new Date()) {
  const since = addDays(startOfDay(now, TZ), -29, TZ)
  const sinceKey = toDateKey(since, TZ)
  const ids = (rows: { businessId: string }[]) => new Set(rows.map((r) => r.businessId))
  const [total, ventas, gastos, fiadoSales, abonos, productos, caja, inventario, merma, pagos, codigos, codigos2, equipo, tracked, firstTracked] =
    await Promise.all([
      db.business.count({ where: { onboardingCompleted: true } }),
      db.sale.groupBy({ by: ["businessId"], where: { createdAt: { gte: since } } }),
      db.expense.groupBy({ by: ["businessId"], where: { createdAt: { gte: since } } }),
      db.sale.groupBy({ by: ["businessId"], where: { createdAt: { gte: since }, paymentMethod: "FIADO" } }),
      db.customerPayment.groupBy({ by: ["businessId"], where: { date: { gte: since } } }),
      db.$queryRaw<{ businessId: string }[]>`
        SELECT DISTINCT s."businessId" FROM "sale_item" i JOIN "sale" s ON s."id" = i."saleId"
        WHERE s."createdAt" >= ${since} AND i."productId" IS NOT NULL`,
      db.cashClosing.groupBy({ by: ["businessId"], where: { createdAt: { gte: since } } }),
      db.inventoryMovement.groupBy({ by: ["businessId"], where: { createdAt: { gte: since }, type: { not: "WASTE" } } }),
      db.inventoryMovement.groupBy({ by: ["businessId"], where: { createdAt: { gte: since }, type: "WASTE" } }),
      db.payable.groupBy({ by: ["businessId"], where: { createdAt: { gte: since } } }),
      db.product.groupBy({ by: ["businessId"], where: { sku: { not: null } } }),
      db.productBarcode.groupBy({ by: ["businessId"] }),
      db.businessMember.groupBy({ by: ["businessId"], _count: true }),
      db.featureUsage.groupBy({ by: ["feature", "businessId"], where: { day: { gte: sinceKey } } }),
      db.featureUsage.aggregate({ _min: { day: true } }),
    ])
  const counts: Record<string, number> = {
    ventas: ventas.length,
    gastos: gastos.length,
    fiado: new Set([...ids(fiadoSales), ...ids(abonos)]).size,
    productos: productos.length,
    caja: caja.length,
    inventario: inventario.length,
    merma: merma.length,
    pagos: pagos.length,
    codigos: new Set([...ids(codigos), ...ids(codigos2)]).size,
    equipo: equipo.filter((e) => e._count > 1).length,
  }
  for (const t of tracked) counts[`uso:${t.feature}`] = (counts[`uso:${t.feature}`] ?? 0) + 1
  return {
    total,
    active: ventas.length,
    rows: FEATURES.map((f) => ({ ...f, count: counts[f.key] ?? 0 })).sort((a, b) => b.count - a.count),
    /** Desde cuándo se mide el uso de las funciones que no dejan registro. */
    trackedSince: firstTracked._min.day,
  }
}

/** Todo lo de una persona para su ficha en el panel. */
export async function getAdminUserDetail(userId: string, businessId?: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      marketingOptIn: true,
      createdAt: true,
      lastActiveAt: true,
      signupSource: true,
      signupMedium: true,
      signupCampaign: true,
      signupReferrer: true,
      sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true, userAgent: true } },
      adminNotes: { orderBy: { createdAt: "desc" }, select: { id: true, text: true, author: true, createdAt: true } },
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          business: {
            select: {
              id: true,
              name: true,
              type: true,
              plan: true,
              planExpiresAt: true,
              discountPercent: true,
              extraProducts: true,
              extraMembers: true,
              timezone: true,
              currency: true,
              createdAt: true,
              _count: { select: { sales: true, expenses: true, products: true, members: true, customers: true } },
              subscriptions: {
                orderBy: { createdAt: "desc" },
                select: { id: true, plan: true, status: true, amount: true, payerEmail: true, lastChargedAt: true, nextPaymentAt: true, createdAt: true },
              },
            },
          },
        },
      },
    },
  })
  if (!user) return null
  const membership = user.memberships.find((m) => m.business.id === businessId) ?? user.memberships[0]
  return { user, membership, activity: membership ? await getBusinessUsage(membership.business.id, membership.business.timezone) : null }
}

type DayRow = { day: string; sales: bigint; total: bigint | null; expenses: bigint }

/** Uso de un negocio: actividad día a día (30 días), ventas por semana (12 semanas) y lo que más vende. */
async function getBusinessUsage(businessId: string, timezone: string, now = new Date()) {
  const today = startOfDay(now, timezone)
  const d30 = addDays(today, -29, timezone)
  const d84 = addDays(today, -83, timezone)
  const d90 = addDays(today, -89, timezone)
  const [days, top, features, lastSale] = await Promise.all([
    db.$queryRaw<DayRow[]>`
      SELECT d.day, COALESCE(s.sales, 0) AS sales, s.total, COALESCE(e.expenses, 0) AS expenses
      FROM (
        SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day FROM "sale" WHERE "businessId" = ${businessId} AND "date" >= ${d84}
        UNION
        SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') FROM "expense" WHERE "businessId" = ${businessId} AND "date" >= ${d84}
      ) d
      LEFT JOIN (
        SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day, COUNT(*) AS sales, SUM("total") AS total
        FROM "sale" WHERE "businessId" = ${businessId} AND "date" >= ${d84} GROUP BY 1
      ) s ON s.day = d.day
      LEFT JOIN (
        SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day, COUNT(*) AS expenses
        FROM "expense" WHERE "businessId" = ${businessId} AND "date" >= ${d84} GROUP BY 1
      ) e ON e.day = d.day`,
    db.$queryRaw<{ name: string; qty: bigint; revenue: bigint }[]>`
      SELECT i."description" AS name, SUM(i."quantity") AS qty, SUM(i."subtotal") AS revenue
      FROM "sale_item" i JOIN "sale" s ON s."id" = i."saleId"
      WHERE s."businessId" = ${businessId} AND s."date" >= ${d90} AND i."productId" IS NOT NULL
      GROUP BY i."description" ORDER BY revenue DESC LIMIT 5`,
    db.featureUsage.groupBy({ by: ["feature"], where: { businessId, day: { gte: toDateKey(d30, timezone) } }, _sum: { count: true } }),
    db.sale.findFirst({ where: { businessId }, orderBy: { date: "desc" }, select: { date: true } }),
  ])

  const byDay = new Map(days.map((d) => [d.day, { sales: Number(d.sales), total: Number(d.total ?? 0), expenses: Number(d.expenses) }]))
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(d30, i, timezone)
    const key = toDateKey(date, timezone)
    const d = byDay.get(key) ?? { sales: 0, total: 0, expenses: 0 }
    return { key, label: formatDate(date, timezone, { weekday: "short", day: "numeric", month: "short" }), ...d }
  })
  const weeks = Array.from({ length: 12 }, (_, w) => {
    const start = addDays(d84, w * 7, timezone)
    let sales = 0
    let total = 0
    for (let i = 0; i < 7; i++) {
      const d = byDay.get(toDateKey(addDays(start, i, timezone), timezone))
      if (d) {
        sales += d.sales
        total += d.total
      }
    }
    return { key: toDateKey(start, timezone), label: formatDate(start, timezone, { day: "numeric", month: "short" }), sales, total }
  })
  return {
    last30,
    activeDays30: last30.filter((d) => d.sales || d.expenses).length,
    sales30: last30.reduce((s, d) => s + d.sales, 0),
    total30: last30.reduce((s, d) => s + d.total, 0),
    weeks,
    top: top.map((t) => ({ name: t.name, qty: Number(t.qty), revenue: Number(t.revenue) })),
    features: features.map((f) => ({ feature: f.feature, count: f._sum.count ?? 0 })),
    lastSaleAt: lastSale?.date ?? null,
  }
}

export type AdminUserDetail = NonNullable<Awaited<ReturnType<typeof getAdminUserDetail>>>

/**
 * De dónde llegan las personas nuevas (últimos 90 días), y cuántas de cada origen avanzan:
 * crearon su negocio, registraron una venta y pagan una suscripción.
 */
export async function getOriginStats(now = new Date()) {
  const since = addDays(startOfDay(now, TZ), -89, TZ)
  const users = await db.user.findMany({
    where: { createdAt: { gte: since } },
    select: {
      signupSource: true,
      signupCampaign: true,
      memberships: {
        where: { role: "OWNER" },
        select: {
          business: {
            select: {
              onboardingCompleted: true,
              _count: { select: { sales: true } },
              subscriptions: { where: { status: "authorized" }, select: { id: true }, take: 1 },
            },
          },
        },
      },
    },
  })
  const rows = new Map<string, { source: string; campaign: string | null; users: number; business: number; selling: number; paying: number }>()
  for (const u of users) {
    const key = `${u.signupSource ?? ""}|${u.signupCampaign ?? ""}`
    const r = rows.get(key) ?? { source: u.signupSource ?? "Directo / sin dato", campaign: u.signupCampaign, users: 0, business: 0, selling: 0, paying: 0 }
    const b = u.memberships.map((m) => m.business)
    r.users++
    if (b.some((x) => x.onboardingCompleted)) r.business++
    if (b.some((x) => x._count.sales > 0)) r.selling++
    if (b.some((x) => x.subscriptions.length > 0)) r.paying++
    rows.set(key, r)
  }
  return [...rows.values()].sort((a, b) => b.users - a.users)
}
