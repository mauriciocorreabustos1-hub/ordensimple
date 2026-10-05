import "server-only"
import { db } from "@/lib/db"
import { startOfMonth, zonedTimeToUtc } from "@/lib/dates"
import { vatFromGross } from "@/lib/vat"

/** Montos registrados en un período, tal como se cobraron y pagaron (con IVA incluido si lo hay). */
export type RawPeriod = {
  sales: number
  /** Ventas de productos con costo registrado, y lo que costaron. */
  knownRevenue: number
  knownCost: number
  /** Compras de mercadería (categorías de gasto que crecen con las ventas, como "Proveedores"). */
  purchases: number
  purchasesInvoiced: number
  /** El resto de los gastos (arriendo, sueldos, cuentas…). */
  otherExpenses: number
  otherInvoiced: number
}

const EMPTY: RawPeriod = { sales: 0, knownRevenue: 0, knownCost: 0, purchases: 0, purchasesInvoiced: 0, otherExpenses: 0, otherInvoiced: 0 }

export type CostMethod = "products" | "purchases" | "none"

export type Statement = ReturnType<typeof buildStatement>

/**
 * Estado de resultados simple.
 * Costo de venta:
 *  - "products": el costo guardado en cada venta de productos. Las ventas sin detalle (ventas rápidas) se
 *    estiman con el mismo margen. Las compras de mercadería no se restan como gasto: van al inventario.
 *  - "purchases": si casi no hay ventas con productos, el costo son las compras de mercadería.
 * Con IVA, todo se muestra sin IVA y el IVA se calcula aparte (débito de ventas − crédito de gastos con factura).
 */
export function buildStatement(raw: RawPeriod, vatRate: number | null) {
  const rate = vatRate ?? 0
  const net = (n: number) => (rate ? n - vatFromGross(n, rate) : n)

  const salesVat = rate ? vatFromGross(raw.sales, rate) : 0
  const netSales = raw.sales - salesVat
  const purchasesCredit = rate ? vatFromGross(raw.purchasesInvoiced, rate) : 0
  const otherCredit = rate ? vatFromGross(raw.otherInvoiced, rate) : 0

  let costMethod: CostMethod = "none"
  if (raw.knownRevenue > 0 && (raw.knownRevenue >= raw.sales * 0.5 || raw.purchases === 0)) costMethod = "products"
  else if (raw.purchases > 0) costMethod = "purchases"

  let costOfSales = 0
  let estimatedCost = 0
  if (costMethod === "products") {
    const unknownRevenue = Math.max(0, raw.sales - raw.knownRevenue)
    estimatedCost = Math.round(unknownRevenue * (raw.knownCost / raw.knownRevenue))
    // El costo de los productos se anota con IVA; para el resultado se usa sin IVA.
    costOfSales = net(raw.knownCost + estimatedCost)
    estimatedCost = net(estimatedCost)
  } else if (costMethod === "purchases") {
    costOfSales = raw.purchases - purchasesCredit
  }

  const grossProfit = netSales - costOfSales
  const operatingExpenses = raw.otherExpenses - otherCredit
  const profit = grossProfit - operatingExpenses
  const vatCredit = purchasesCredit + otherCredit
  const vatBalance = salesVat - vatCredit

  return {
    sales: raw.sales,
    salesVat,
    netSales,
    costMethod,
    costOfSales,
    estimatedCost,
    grossProfit,
    grossMargin: netSales > 0 ? grossProfit / netSales : null,
    operatingExpenses,
    /** Compras de mercadería que no se restan (van al inventario) cuando el costo sale de los productos. */
    purchasesToInventory: costMethod === "products" ? raw.purchases - purchasesCredit : 0,
    profit,
    margin: netSales > 0 ? profit / netSales : null,
    vat: { debit: salesVat, credit: vatCredit, toPay: Math.max(0, vatBalance), inFavor: Math.max(0, -vatBalance) },
  }
}

type ExpenseRow = { categoryId: string | null; isVariable: boolean | null; hasInvoice: boolean; total: bigint | number | null }

function addExpense(raw: RawPeriod, row: { isVariable: boolean | null; hasInvoice: boolean; total: number }) {
  if (row.isVariable) {
    raw.purchases += row.total
    if (row.hasInvoice) raw.purchasesInvoiced += row.total
  } else {
    raw.otherExpenses += row.total
    if (row.hasInvoice) raw.otherInvoiced += row.total
  }
}

/** Estado de resultados de un período, con el detalle de gastos por categoría. */
export async function getIncomeStatement(businessId: string, from: Date, to: Date, vatRate: number | null) {
  const [sales, known, expenses] = await Promise.all([
    db.sale.aggregate({ where: { businessId, date: { gte: from, lt: to } }, _sum: { total: true }, _count: true }),
    db.$queryRaw<{ revenue: bigint | null; cost: bigint | null }[]>`
      SELECT SUM(i."subtotal") AS revenue, SUM(i."quantity" * i."unitCost") AS cost
      FROM "sale_item" i JOIN "sale" s ON s."id" = i."saleId"
      WHERE s."businessId" = ${businessId} AND s."date" >= ${from} AND s."date" < ${to} AND i."unitCost" > 0`,
    db.$queryRaw<(ExpenseRow & { name: string | null })[]>`
      SELECT e."categoryId", c."name", c."isVariable", e."hasInvoice", SUM(e."amount") AS total
      FROM "expense" e LEFT JOIN "expense_category" c ON c."id" = e."categoryId"
      WHERE e."businessId" = ${businessId} AND e."date" >= ${from} AND e."date" < ${to}
      GROUP BY e."categoryId", c."name", c."isVariable", e."hasInvoice"`,
  ])

  const raw: RawPeriod = {
    ...EMPTY,
    sales: sales._sum.total ?? 0,
    knownRevenue: Number(known[0]?.revenue ?? 0),
    knownCost: Number(known[0]?.cost ?? 0),
  }
  const rate = vatRate ?? 0
  const byCategory = new Map<string, { name: string; isVariable: boolean; total: number }>()
  for (const row of expenses) {
    const total = Number(row.total ?? 0)
    addExpense(raw, { isVariable: row.isVariable, hasInvoice: row.hasInvoice, total })
    const key = row.categoryId ?? "none"
    const cat = byCategory.get(key) ?? { name: row.name ?? "Sin categoría", isVariable: Boolean(row.isVariable), total: 0 }
    // Sin IVA cuando el gasto tiene factura (ese IVA se recupera).
    cat.total += rate && row.hasInvoice ? total - vatFromGross(total, rate) : total
    byCategory.set(key, cat)
  }

  return {
    raw,
    salesCount: sales._count,
    statement: buildStatement(raw, vatRate),
    categories: [...byCategory.values()].sort((a, b) => b.total - a.total),
  }
}

/** Estado de resultados de cada mes ("YYYY-MM") entre dos fechas, en la zona horaria del negocio. */
export async function getMonthlyStatements(businessId: string, from: Date, to: Date, timezone: string, vatRate: number | null) {
  type Bucket = { bucket: string }
  const [sales, known, expenses] = await Promise.all([
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
             c."isVariable", e."hasInvoice", SUM(e."amount") AS total
      FROM "expense" e LEFT JOIN "expense_category" c ON c."id" = e."categoryId"
      WHERE e."businessId" = ${businessId} AND e."date" >= ${from} AND e."date" < ${to}
      GROUP BY bucket, c."isVariable", e."hasInvoice"`,
  ])

  const months = new Map<string, RawPeriod>()
  const get = (key: string) => {
    let m = months.get(key)
    if (!m) months.set(key, (m = { ...EMPTY }))
    return m
  }
  for (const r of sales) get(r.bucket).sales = Number(r.total ?? 0)
  for (const r of known) {
    get(r.bucket).knownRevenue = Number(r.revenue ?? 0)
    get(r.bucket).knownCost = Number(r.cost ?? 0)
  }
  for (const r of expenses) addExpense(get(r.bucket), { isVariable: r.isVariable, hasInvoice: r.hasInvoice, total: Number(r.total ?? 0) })

  return (key: string) => buildStatement(months.get(key) ?? EMPTY, vatRate)
}

/**
 * Resumen de un año, mes a mes (de enero a `lastMonth`), con la suma del año.
 * El IVA a favor de un mes se descuenta del mes siguiente.
 */
export async function getYearSummary(businessId: string, year: number, lastMonth: number, timezone: string, vatRate: number | null) {
  const from = zonedTimeToUtc(year, 1, 1, timezone)
  const to = startOfMonth(zonedTimeToUtc(year, lastMonth, 1, timezone), timezone, 1)
  const monthly = await getMonthlyStatements(businessId, from, to, timezone, vatRate)

  let carry = 0
  const rows = Array.from({ length: lastMonth }, (_, i) => {
    const m = i + 1
    const s = monthly(`${year}-${String(m).padStart(2, "0")}`)
    const balance = s.vat.debit - s.vat.credit - carry
    const carryIn = carry
    carry = Math.max(0, -balance)
    return { month: m, s, vatToPay: Math.max(0, balance), carryIn, carryOut: carry }
  })
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((acc, r) => acc + f(r), 0)
  const totals = {
    sales: sum((r) => r.s.sales),
    salesVat: sum((r) => r.s.salesVat),
    netSales: sum((r) => r.s.netSales),
    costOfSales: sum((r) => r.s.costOfSales),
    grossProfit: sum((r) => r.s.grossProfit),
    operatingExpenses: sum((r) => r.s.operatingExpenses),
    profit: sum((r) => r.s.profit),
    vatToPay: sum((r) => r.vatToPay),
  }
  return { rows, totals }
}
