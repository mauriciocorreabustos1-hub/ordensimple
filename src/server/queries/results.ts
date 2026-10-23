import "server-only"
import { db } from "@/lib/db"
import { startOfMonth, zonedTimeToUtc } from "@/lib/dates"
import { buildStatement, EMPTY_PERIOD, vatWithCarry, withoutVatCredit, type RawPeriod } from "@/lib/income-statement"
import { vatFromGross } from "@/lib/vat"

type ExpenseRow = {
  categoryId: string | null
  name: string | null
  isVariable: boolean | null
  hasInvoice: boolean
  total: bigint | number | null
  /** Impuestos específicos de esas facturas (ILA, combustibles): no son IVA, no se descuentan. */
  specific: bigint | number | null
  withholding: bigint | number | null
}

/** ¿Este gasto descuenta IVA? Solo con factura y si es un gasto que puede traer IVA. */
const creditsVat = (row: { name: string | null; hasInvoice: boolean }) => row.hasInvoice && !withoutVatCredit(row.name)

function addExpense(raw: RawPeriod, row: { name: string | null; isVariable: boolean | null; hasInvoice: boolean; total: number; specific: number; withholding: number }) {
  const credits = creditsVat(row)
  // El IVA de la factura se calcula sin sus impuestos específicos (el ILA no es IVA); el total igual es costo.
  const invoiced = credits ? row.total - row.specific : 0
  if (row.isVariable) {
    raw.purchases += row.total
    raw.purchasesInvoiced += invoiced
  } else {
    raw.otherExpenses += row.total
    raw.otherInvoiced += invoiced
  }
  raw.withholding += row.withholding
}

/** Estado de resultados de un período, con el detalle de gastos por categoría. */
export async function getIncomeStatement(businessId: string, from: Date, to: Date, vatRate: number | null) {
  const [sales, known, expenses, waste] = await Promise.all([
    db.sale.aggregate({ where: { businessId, date: { gte: from, lt: to } }, _sum: { total: true }, _count: true }),
    db.$queryRaw<{ revenue: bigint | null; cost: bigint | null }[]>`
      SELECT SUM(i."subtotal") AS revenue, SUM(i."quantity" * i."unitCost") AS cost
      FROM "sale_item" i JOIN "sale" s ON s."id" = i."saleId"
      WHERE s."businessId" = ${businessId} AND s."date" >= ${from} AND s."date" < ${to} AND i."unitCost" > 0`,
    db.$queryRaw<ExpenseRow[]>`
      SELECT e."categoryId", c."name", c."isVariable", e."hasInvoice", SUM(e."amount") AS total,
             SUM(e."specificTax") AS specific, SUM(e."withholding") AS withholding
      FROM "expense" e LEFT JOIN "expense_category" c ON c."id" = e."categoryId"
      WHERE e."businessId" = ${businessId} AND e."date" >= ${from} AND e."date" < ${to}
      GROUP BY e."categoryId", c."name", c."isVariable", e."hasInvoice"`,
    db.$queryRaw<{ cost: bigint | null }[]>`
      SELECT SUM(-"quantity" * "unitCost") AS cost FROM "inventory_movement"
      WHERE "businessId" = ${businessId} AND "type" = 'WASTE' AND "createdAt" >= ${from} AND "createdAt" < ${to}`,
  ])

  const raw: RawPeriod = {
    ...EMPTY_PERIOD,
    sales: sales._sum.total ?? 0,
    knownRevenue: Number(known[0]?.revenue ?? 0),
    knownCost: Number(known[0]?.cost ?? 0),
    waste: Number(waste[0]?.cost ?? 0),
  }
  const rate = vatRate ?? 0
  const byCategory = new Map<string, { name: string; isVariable: boolean; total: number }>()
  for (const row of expenses) {
    const total = Number(row.total ?? 0)
    const specific = Number(row.specific ?? 0)
    addExpense(raw, { name: row.name, isVariable: row.isVariable, hasInvoice: row.hasInvoice, total, specific, withholding: Number(row.withholding ?? 0) })
    const key = row.categoryId ?? "none"
    const cat = byCategory.get(key) ?? { name: row.name ?? "Sin categoría", isVariable: Boolean(row.isVariable), total: 0 }
    // Sin IVA cuando el gasto tiene factura (ese IVA se recupera).
    cat.total += rate && creditsVat(row) ? total - vatFromGross(total - specific, rate) : total
    byCategory.set(key, cat)
  }

  return {
    raw,
    salesCount: sales._count,
    statement: buildStatement(raw, vatRate),
    categories: [...byCategory.values()].sort((a, b) => b.total - a.total),
  }
}

/** Montos de cada mes ("YYYY-MM") entre dos fechas, en la zona horaria del negocio. */
async function getMonthlyRaw(businessId: string, from: Date, to: Date, timezone: string) {
  type Bucket = { bucket: string }
  const [sales, known, expenses, waste] = await Promise.all([
    db.$queryRaw<(Bucket & { total: bigint | null })[]>`
      SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM') AS bucket, SUM("total") AS total
      FROM "sale"
      WHERE "businessId" = ${businessId} AND "date" >= ${from} AND "date" < ${to}
      GROUP BY bucket`,
    db.$queryRaw<(Bucket & { revenue: bigint | null; cost: bigint | null })[]>`
      SELECT to_char((s."date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM') AS bucket,
             SUM(i."subtotal") AS revenue, SUM(i."quantity" * i."unitCost") AS cost
      FROM "sale_item" i JOIN "sale" s ON s."id" = i."saleId"
      WHERE s."businessId" = ${businessId} AND s."date" >= ${from} AND s."date" < ${to} AND i."unitCost" > 0
      GROUP BY bucket`,
    db.$queryRaw<(Bucket & ExpenseRow)[]>`
      SELECT to_char((e."date" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM') AS bucket,
             c."name", c."isVariable", e."hasInvoice", SUM(e."amount") AS total,
             SUM(e."specificTax") AS specific, SUM(e."withholding") AS withholding
      FROM "expense" e LEFT JOIN "expense_category" c ON c."id" = e."categoryId"
      WHERE e."businessId" = ${businessId} AND e."date" >= ${from} AND e."date" < ${to}
      GROUP BY bucket, c."name", c."isVariable", e."hasInvoice"`,
    db.$queryRaw<(Bucket & { cost: bigint | null })[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM') AS bucket, SUM(-"quantity" * "unitCost") AS cost
      FROM "inventory_movement"
      WHERE "businessId" = ${businessId} AND "type" = 'WASTE' AND "createdAt" >= ${from} AND "createdAt" < ${to}
      GROUP BY bucket`,
  ])

  const months = new Map<string, RawPeriod>()
  const get = (key: string) => {
    let m = months.get(key)
    if (!m) months.set(key, (m = { ...EMPTY_PERIOD }))
    return m
  }
  for (const r of sales) get(r.bucket).sales = Number(r.total ?? 0)
  for (const r of known) {
    get(r.bucket).knownRevenue = Number(r.revenue ?? 0)
    get(r.bucket).knownCost = Number(r.cost ?? 0)
  }
  for (const r of expenses)
    addExpense(get(r.bucket), {
      name: r.name,
      isVariable: r.isVariable,
      hasInvoice: r.hasInvoice,
      total: Number(r.total ?? 0),
      specific: Number(r.specific ?? 0),
      withholding: Number(r.withholding ?? 0),
    })
  for (const r of waste) get(r.bucket).waste = Number(r.cost ?? 0)
  return (key: string) => months.get(key) ?? EMPTY_PERIOD
}

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`

/**
 * Resumen de un año, mes a mes (de enero a `lastMonth`), con la suma del año.
 * El IVA a favor de un mes se descuenta del mes siguiente; para eso se parte desde enero del año anterior,
 * así lo que quedó a favor en diciembre pasa a enero.
 */
export async function getYearSummary(businessId: string, year: number, lastMonth: number, timezone: string, vatRate: number | null) {
  const from = zonedTimeToUtc(year - 1, 1, 1, timezone)
  const to = startOfMonth(zonedTimeToUtc(year, lastMonth, 1, timezone), timezone, 1)
  const raw = await getMonthlyRaw(businessId, from, to, timezone)

  const months = [
    ...Array.from({ length: 12 }, (_, i) => ({ year: year - 1, month: i + 1 })),
    ...Array.from({ length: lastMonth }, (_, i) => ({ year, month: i + 1 })),
  ]
  const statements = months.map((m) => buildStatement(raw(monthKey(m.year, m.month)), vatRate))
  const vat = vatWithCarry(statements)
  const rows = months
    .map((m, i) => ({ ...m, s: statements[i], ...vat[i] }))
    .filter((r) => r.year === year)

  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((acc, r) => acc + f(r), 0)
  const totals = {
    sales: sum((r) => r.s.sales),
    salesVat: sum((r) => r.s.salesVat),
    netSales: sum((r) => r.s.netSales),
    costOfSales: sum((r) => r.s.costOfSales),
    grossProfit: sum((r) => r.s.grossProfit),
    operatingExpenses: sum((r) => r.s.operatingExpenses + r.s.waste),
    profit: sum((r) => r.s.profit),
    vatToPay: sum((r) => r.vatToPay),
    withholding: sum((r) => r.s.withholding),
  }
  return { rows, totals }
}
