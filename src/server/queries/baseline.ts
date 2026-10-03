import "server-only"
import { db } from "@/lib/db"
import { addDays, startOfDay } from "@/lib/dates"

/**
 * Números reales de los últimos 30 días para prellenar las herramientas.
 * - sales: ventas registradas
 * - variableCosts: costo de lo vendido. Se usa el costo guardado en cada venta; si no hay,
 *   las compras de mercadería (categorías de gasto marcadas como variables).
 * - fixedCosts: gastos registrados que NO son compras de mercadería (arriendo, sueldos, cuentas…).
 *   Así no se cuenta dos veces la mercadería.
 * - marginPct: % que queda de cada venta después de pagar el producto (si hay datos para calcularlo)
 */
export async function getBaseline(businessId: string, timezone: string, now = new Date()) {
  const to = addDays(startOfDay(now, timezone), 1, timezone)
  const from = addDays(to, -30, timezone)
  const range = { gte: from, lt: to }

  const [sales, fixed, purchases, items, products] = await Promise.all([
    db.sale.aggregate({ where: { businessId, date: range }, _sum: { total: true }, _count: true }),
    db.expense.aggregate({
      where: { businessId, date: range, OR: [{ categoryId: null }, { category: { isVariable: false } }] },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { businessId, date: range, category: { isVariable: true } },
      _sum: { amount: true },
    }),
    db.saleItem.findMany({
      where: { sale: { businessId, date: range }, productId: { not: null } },
      select: { quantity: true, unitCost: true, subtotal: true },
    }),
    db.product.findMany({
      where: { businessId, active: true, price: { gt: 0 } },
      select: { cost: true, price: true },
    }),
  ])

  const salesTotal = sales._sum.total ?? 0
  const productSales = items.reduce((s, i) => s + i.subtotal, 0)
  const productCost = items.reduce((s, i) => s + i.quantity * i.unitCost, 0)

  // Margen de lo vendido con productos; si no hay, el margen promedio del catálogo.
  let marginPct: number | null = null
  if (productSales > 0 && productCost > 0) {
    marginPct = ((productSales - productCost) / productSales) * 100
  } else if (products.length) {
    const avg = products.reduce((s, p) => s + (p.price - p.cost) / p.price, 0) / products.length
    marginPct = avg * 100
  }

  const purchasesTotal = purchases._sum.amount ?? 0
  const fixedCosts = fixed._sum.amount ?? 0

  // Costo de lo vendido: extrapolado de las ventas con productos (cubre ventas rápidas sin detalle);
  // si no hay ventas con costo conocido, usamos lo que se compró en mercadería.
  const variableCosts =
    productSales > 0 && productCost > 0 && salesTotal > 0
      ? Math.round(productCost * (salesTotal / productSales))
      : purchasesTotal

  const avgPrice = products.length ? Math.round(products.reduce((s, p) => s + p.price, 0) / products.length) : 0
  const avgCost = products.length ? Math.round(products.reduce((s, p) => s + p.cost, 0) / products.length) : 0

  return {
    sales: salesTotal,
    salesCount: sales._count,
    fixedCosts,
    variableCosts,
    purchases: purchasesTotal,
    marginPct: marginPct !== null ? Math.round(Math.max(0, Math.min(100, marginPct))) : null,
    avgPrice,
    avgCost,
    hasData: salesTotal > 0 || fixedCosts + purchasesTotal > 0,
  }
}

export type Baseline = Awaited<ReturnType<typeof getBaseline>>
