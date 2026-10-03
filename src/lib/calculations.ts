// Fórmulas puras de negocio. Todos los montos en unidades mínimas de la moneda.

/** Margen sobre el precio de venta: (precio − costo) / precio. */
export function marginRatio(price: number, cost: number) {
  if (price <= 0) return 0
  return (price - cost) / price
}

/** Precio necesario para obtener un margen deseado sobre el precio de venta. */
export function priceForMargin(totalCost: number, marginPct: number) {
  const m = marginPct / 100
  if (m >= 1 || totalCost <= 0) return null
  return Math.ceil(totalCost / (1 - m))
}

export type BreakEvenResult =
  | { ok: true; units: number; salesAmount: number; unitContribution: number }
  | { ok: false; reason: "price-below-cost" | "missing-data" }

/** Unidades y ventas necesarias para cubrir los costos fijos del mes. */
export function breakEven(fixedCosts: number, unitCost: number, price: number): BreakEvenResult {
  if (price <= 0 || fixedCosts < 0) return { ok: false, reason: "missing-data" }
  const unitContribution = price - unitCost
  if (unitContribution <= 0) return { ok: false, reason: "price-below-cost" }
  const units = Math.ceil(fixedCosts / unitContribution)
  return { ok: true, units, salesAmount: units * price, unitContribution }
}

export type GoalResult =
  | { ok: true; monthly: number; weekly: number; daily: number }
  | { ok: false; reason: "invalid-margin" }

/**
 * Ventas necesarias para llegar a una ganancia objetivo.
 * marginPct: de cada venta, qué porcentaje queda después de pagar el producto.
 */
export function salesForGoal(targetProfit: number, fixedCosts: number, marginPct: number, daysInMonth = 30): GoalResult {
  const m = marginPct / 100
  if (m <= 0 || m > 1) return { ok: false, reason: "invalid-margin" }
  const monthly = Math.ceil((targetProfit + fixedCosts) / m)
  return {
    ok: true,
    monthly,
    weekly: Math.ceil((monthly / daysInMonth) * 7),
    daily: Math.ceil(monthly / daysInMonth),
  }
}

export type SimulationBase = {
  /** Ventas del mes. */
  sales: number
  /** Costo de lo vendido (mercadería, insumos) en el mes. */
  variableCosts: number
  /** Gastos fijos del mes: arriendo, sueldos, servicios, etc. */
  fixedCosts: number
}

export type SimulationChange = {
  /** Cambio de precio en %, con la misma cantidad vendida. */
  pricePct?: number
  /** Cambio en la cantidad vendida en %. */
  volumePct?: number
  /** Cambio en el costo de lo que vendes en %. */
  variableCostPct?: number
  /** Gasto fijo adicional al mes. */
  extraFixed?: number
}

export type SimulationResult = SimulationBase & { profit: number }

export function profitOf(base: SimulationBase): SimulationResult {
  return { ...base, profit: base.sales - base.variableCosts - base.fixedCosts }
}

export function simulate(base: SimulationBase, change: SimulationChange): SimulationResult {
  const volume = 1 + (change.volumePct ?? 0) / 100
  const price = 1 + (change.pricePct ?? 0) / 100
  const unitCost = 1 + (change.variableCostPct ?? 0) / 100
  const sales = Math.round(base.sales * volume * price)
  const variableCosts = Math.round(base.variableCosts * volume * unitCost)
  const fixedCosts = Math.round(base.fixedCosts + (change.extraFixed ?? 0))
  return profitOf({ sales, variableCosts, fixedCosts })
}

/** Variación porcentual entre dos valores. null si no hay base para comparar. */
export function percentChange(current: number, previous: number) {
  if (previous === 0) return null
  return (current - previous) / Math.abs(previous)
}

export type HealthStatus = "good" | "warning" | "bad" | "empty"

export type Health = { status: HealthStatus; title: string; message: string }

/**
 * Estado del negocio en los últimos 30 días, comparado con los 30 anteriores.
 * Se usa una ventana móvil para que los gastos fijos de inicio de mes (arriendo) no pinten todo de rojo.
 */
export function businessHealth(input: {
  sales: number
  expenses: number
  prevSales: number
}): Health {
  const { sales: monthSales, expenses: monthExpenses, prevSales: prevPeriodSales } = input
  if (monthSales === 0 && monthExpenses === 0) {
    return {
      status: "empty",
      title: "Aún no hay datos suficientes",
      message: "Registra tus ventas y gastos y aquí te diremos cómo va tu negocio.",
    }
  }
  if (monthExpenses > monthSales) {
    return {
      status: "bad",
      title: "Tus gastos están superando tus ventas",
      message: "En los últimos 30 días gastaste más de lo que vendiste. Revisa en qué estás gastando más.",
    }
  }
  const margin = monthSales > 0 ? (monthSales - monthExpenses) / monthSales : 0
  const change = percentChange(monthSales, prevPeriodSales)
  if (margin < 0.1) {
    return {
      status: "warning",
      title: "Hay cosas que revisar",
      message: "Tus ventas apenas cubren tus gastos. Te queda muy poco como ganancia.",
    }
  }
  if (change !== null && change < -0.15) {
    return {
      status: "warning",
      title: "Hay cosas que revisar",
      message: "En los últimos 30 días vendiste bastante menos que en los 30 días anteriores.",
    }
  }
  return {
    status: "good",
    title: "Vas bien",
    message: "En los últimos 30 días tus ventas cubrieron tus gastos y te quedó ganancia.",
  }
}
