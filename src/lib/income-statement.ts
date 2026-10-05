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

export const EMPTY_PERIOD: RawPeriod = {
  sales: 0,
  knownRevenue: 0,
  knownCost: 0,
  purchases: 0,
  purchasesInvoiced: 0,
  otherExpenses: 0,
  otherInvoiced: 0,
}

export type CostMethod = "products" | "purchases" | "none"

export type Statement = ReturnType<typeof buildStatement>

/** Categorías de gasto que son compras de mercadería (su costo se cuenta en el costo de venta, no como gasto). */
export function isPurchaseCategory(name: string) {
  return /mercader|mercanc|proveedor|insumo|materia prima/i.test(name)
}

/**
 * Estado de resultados simple.
 *
 * Costo de venta:
 *  - "products": el costo guardado en cada venta de productos. Las ventas sin detalle (ventas rápidas) se
 *    estiman con el mismo margen. Las compras de mercadería no se restan como gasto: van al inventario.
 *  - "purchases": si casi no hay ventas con productos, el costo son las compras de mercadería del período.
 *
 * Con IVA (precios con IVA incluido):
 *  - IVA débito = IVA contenido en las ventas. IVA crédito = IVA contenido en los gastos con factura.
 *  - El resultado se muestra sin IVA. Solo se descuenta el IVA de lo que tiene factura (lo que se recupera);
 *    el IVA de una compra sin factura es parte del costo. Para el costo de los productos se usa la misma
 *    proporción de compras de mercadería con factura del período (si no hubo compras, se asume con factura).
 */
export function buildStatement(raw: RawPeriod, vatRate: number | null) {
  const rate = vatRate ?? 0
  const vat = (n: number) => (rate ? vatFromGross(n, rate) : 0)

  const salesVat = vat(raw.sales)
  const netSales = raw.sales - salesVat
  const purchasesCredit = vat(raw.purchasesInvoiced)
  const otherCredit = vat(raw.otherInvoiced)

  let costMethod: CostMethod = "none"
  if (raw.knownRevenue > 0 && (raw.knownRevenue >= raw.sales * 0.5 || raw.purchases === 0)) costMethod = "products"
  else if (raw.purchases > 0) costMethod = "purchases"

  let costOfSales = 0
  let estimatedCost = 0
  if (costMethod === "products") {
    const unknownRevenue = Math.max(0, raw.sales - raw.knownRevenue)
    const estimatedGross = Math.round(unknownRevenue * (raw.knownCost / raw.knownRevenue))
    const invoicedShare = raw.purchases > 0 ? raw.purchasesInvoiced / raw.purchases : 1
    const netOf = (gross: number) => gross - Math.round(vat(gross) * invoicedShare)
    costOfSales = netOf(raw.knownCost + estimatedGross)
    estimatedCost = netOf(estimatedGross)
  } else if (costMethod === "purchases") {
    costOfSales = raw.purchases - purchasesCredit
  }

  const grossProfit = netSales - costOfSales
  const operatingExpenses = raw.otherExpenses - otherCredit
  const profit = grossProfit - operatingExpenses
  const vatCredit = purchasesCredit + otherCredit

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
    vat: { debit: salesVat, credit: vatCredit },
  }
}

/**
 * IVA de una serie de meses en orden: lo que queda a favor un mes se descuenta del mes siguiente.
 * Devuelve, por mes, el IVA a pagar, lo que venía a favor y lo que queda a favor.
 */
export function vatWithCarry(statements: Statement[], initialCarry = 0) {
  let carry = initialCarry
  return statements.map((s) => {
    const balance = s.vat.debit - s.vat.credit - carry
    const carryIn = carry
    carry = Math.max(0, -balance)
    return { vatToPay: Math.max(0, balance), carryIn, carryOut: carry }
  })
}
