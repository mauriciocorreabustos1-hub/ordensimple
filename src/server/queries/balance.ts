import "server-only"
import { db } from "@/lib/db"
import { formatDate, startOfMonth, toMonthKey, zonedParts } from "@/lib/dates"
import { ppmAmount, vatInfo } from "@/lib/vat"
import { getDebtors } from "@/server/queries/fiado"
import { getInventory } from "@/server/queries/inventory"
import { getYearSummary } from "@/server/queries/results"
import type { BusinessContext } from "@/server/session"

/**
 * Balance simple: lo que el negocio tiene menos lo que debe, con los datos que ya están en la app.
 * La plata en caja y banco parte de lo que el dueño declaró y se sigue sola con ventas cobradas,
 * abonos, gastos y retiros. Es aproximado: no reemplaza la contabilidad.
 */
export async function getBalance(ctx: BusinessContext, now = new Date()) {
  const { businessId, timezone } = ctx
  const s = ctx.settings
  const today = zonedParts(now, timezone)
  const monthStart = startOfMonth(now, timezone)
  const vat = vatInfo(ctx.business.country)
  const chargesVat = Boolean(vat && s.chargesVat)
  const since = s.openingCashAt ?? null

  const [inventory, debtors, payables, loans, year, cashIn, abonos, cashOut, withdrawalsOut, monthWithdrawals, recentWithdrawals, history, depositsIn] =
    await Promise.all([
      getInventory(businessId, timezone, now),
      getDebtors(businessId),
      db.payable.aggregate({ where: { businessId, paidAt: null }, _sum: { amount: true }, _count: true }),
      db.loan.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
      getYearSummary(businessId, today.year, today.month, timezone, chargesVat ? vat!.rate : null),
      // Lo que se anotó después de declarar la plata (la cifra declarada ya incluye todo lo anterior).
      since ? db.sale.aggregate({ where: { businessId, createdAt: { gte: since }, paymentMethod: { not: "FIADO" } }, _sum: { total: true } }) : null,
      since ? db.customerPayment.aggregate({ where: { businessId, createdAt: { gte: since } }, _sum: { amount: true } }) : null,
      since ? db.expense.aggregate({ where: { businessId, createdAt: { gte: since } }, _sum: { amount: true } }) : null,
      since ? db.ownerWithdrawal.aggregate({ where: { businessId, createdAt: { gte: since }, kind: "MONEY" }, _sum: { amount: true } }) : null,
      db.ownerWithdrawal.findMany({ where: { businessId, date: { gte: monthStart } }, orderBy: { date: "desc" } }),
      db.$queryRaw<{ month: string; total: bigint }[]>`
        SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM') AS month, SUM("amount") AS total
        FROM "owner_withdrawal" WHERE "businessId" = ${businessId} AND "date" >= ${startOfMonth(now, timezone, -5)} AND "kind" <> 'DEPOSIT'
        GROUP BY month ORDER BY month`,
      db.balanceSnapshot.findMany({ where: { businessId }, orderBy: { month: "desc" }, take: 12 }),
      since ? db.ownerWithdrawal.aggregate({ where: { businessId, createdAt: { gte: since }, kind: "DEPOSIT" }, _sum: { amount: true } }) : null,
    ])

  // Plata en caja y banco: lo declarado + lo que entró − lo que salió desde ese momento.
  const cash =
    s.openingCash === null || s.openingCash === undefined
      ? null
      : s.openingCash +
        (cashIn?._sum.total ?? 0) +
        (abonos?._sum.amount ?? 0) +
        (depositsIn?._sum.amount ?? 0) -
        (cashOut?._sum.amount ?? 0) -
        (withdrawalsOut?._sum.amount ?? 0)

  const row = year.rows[today.month - 1]
  const ppm = chargesVat && ctx.business.country === "CL" ? ppmAmount(row.s.netSales, s.ppmRate) : 0
  // La retención de honorarios se paga en el F29 aunque el negocio no cobre IVA.
  const taxesDue = (chargesVat ? row.vatToPay + ppm : 0) + row.s.withholding
  const vatInFavor = chargesVat ? row.carryOut : 0

  const assets = [
    { key: "cash", label: "Dinero en caja y banco", value: cash ?? 0, missing: cash === null, href: null as string | null },
    { key: "stock", label: "Mercadería en bodega (al costo)", value: inventory.value, href: "/dashboard/inventario" },
    { key: "fiado", label: "Fiado por cobrar", value: debtors.total, href: "/dashboard/clientes?segmento=deben" },
    ...(vatInFavor ? [{ key: "vat", label: `${vat!.label} a favor`, value: vatInFavor, href: "/dashboard/resultados" }] : []),
  ]
  const liabilities = [
    { key: "payables", label: "Facturas por pagar a proveedores", value: payables._sum.amount ?? 0, href: "/dashboard/proveedores#pagos" },
    ...(chargesVat ? [{ key: "taxes", label: ctx.business.country === "CL" ? "IVA + PPM de este mes" : `${vat!.label} de este mes`, value: taxesDue, href: "/dashboard/resultados" }] : []),
    { key: "loans", label: "Préstamos y deudas", value: loans.reduce((sum, l) => sum + l.balance, 0), href: "#prestamos" },
  ]
  const totalAssets = assets.reduce((sum, a) => sum + a.value, 0)
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.value, 0)

  // Foto del mes (la última vez que se miró): sirve para ver cómo cambia mes a mes.
  const month = toMonthKey(now, timezone)
  await db.balanceSnapshot
    .upsert({
      where: { businessId_month: { businessId, month } },
      create: { businessId, month, assets: totalAssets, liabilities: totalLiabilities },
      update: { assets: totalAssets, liabilities: totalLiabilities },
    })
    .catch(() => {})
  const snapshots = [{ month, assets: totalAssets, liabilities: totalLiabilities }, ...history.filter((h) => h.month !== month)]
    .slice(0, 12)
    .reverse()
    .map((h) => {
      const [y, m] = h.month.split("-").map(Number)
      return { month: h.month, label: formatDate(new Date(Date.UTC(y, m - 1, 15)), "UTC", { month: "short" }).replace(".", ""), net: h.assets - h.liabilities }
    })

  const withdrawnThisMonth = monthWithdrawals.filter((w) => w.kind !== "DEPOSIT").reduce((sum, w) => sum + w.amount, 0)
  const depositedThisMonth = monthWithdrawals.filter((w) => w.kind === "DEPOSIT").reduce((sum, w) => sum + w.amount, 0)
  // Utilidad del mes: la de Resultados (sin IVA, con costo de venta).
  const profit = row.s.profit

  return {
    assets,
    liabilities,
    totalAssets,
    totalLiabilities,
    net: totalAssets - totalLiabilities,
    cashSince: since,
    loans,
    snapshots,
    withdrawals: {
      list: monthWithdrawals,
      total: withdrawnThisMonth,
      deposited: depositedThisMonth,
      profit,
      leftInBusiness: profit - withdrawnThisMonth,
      salary: s.ownerSalary ?? null,
      byMonth: recentWithdrawals.map((r) => ({ month: r.month, total: Number(r.total) })),
    },
    /** Días que faltan para la próxima cuota de cada préstamo (si tiene día de pago). */
    nextDue: (dueDay: number | null) => {
      if (!dueDay) return null
      const d = new Date(Date.UTC(today.year, today.month - 1, Math.min(dueDay, 28)))
      const target = today.day <= dueDay ? d : new Date(Date.UTC(today.year, today.month, Math.min(dueDay, 28)))
      return Math.round((target.getTime() - Date.UTC(today.year, today.month - 1, today.day)) / 86_400_000)
    },
  }
}

export type BalanceData = Awaited<ReturnType<typeof getBalance>>
