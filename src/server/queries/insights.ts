import "server-only"
import { percentChange } from "@/lib/calculations"
import { formatMoney, formatPercent } from "@/lib/currency"
import { addDays, startOfDay } from "@/lib/dates"
import { totalsBetween } from "@/server/queries/aggregates"
import { getInventory } from "@/server/queries/inventory"
import { expensesByCategory } from "@/server/queries/records"
import { productStats } from "@/server/queries/reports"

export type Insight = {
  id: string
  tone: "good" | "warning" | "info"
  text: string
  href?: string
}

/**
 * Consejos calculados con los datos reales del negocio (últimos 30 días vs. los 30 anteriores).
 * Cada consejo solo aparece si hay datos suficientes para afirmarlo; nunca se inventan.
 */
export async function getInsights(businessId: string, timezone: string, currency: string, now = new Date()): Promise<Insight[]> {
  const money = (n: number) => formatMoney(n, currency)
  const to = addDays(startOfDay(now, timezone), 1, timezone)
  const from = addDays(to, -30, timezone)
  const prevFrom = addDays(to, -60, timezone)

  const [current, previous, products, categories, inventory] = await Promise.all([
    totalsBetween(businessId, from, to),
    totalsBetween(businessId, prevFrom, from),
    productStats(businessId, from, to),
    expensesByCategory(businessId, from, to, { cardFees: true }),
    getInventory(businessId, timezone, now),
  ])

  const tips: Insight[] = []
  const salesChange = percentChange(current.sales, previous.sales)
  const expensesChange = percentChange(current.expenses, previous.expenses)

  if (salesChange !== null && Math.abs(salesChange) >= 0.1 && previous.salesCount >= 5) {
    tips.push(
      salesChange > 0
        ? {
            id: "sales-up",
            tone: "good",
            text: `Tus ventas aumentaron ${formatPercent(salesChange, 0)} respecto a los 30 días anteriores.`,
          }
        : {
            id: "sales-down",
            tone: "warning",
            text: `Tus ventas bajaron ${formatPercent(-salesChange, 0)} respecto a los 30 días anteriores.`,
            href: "/dashboard/reportes",
          },
    )
  }

  if (
    expensesChange !== null &&
    salesChange !== null &&
    expensesChange > 0.1 &&
    expensesChange - salesChange > 0.1 &&
    previous.expenses > 0
  ) {
    tips.push({
      id: "expenses-faster",
      tone: "warning",
      text: `Tus gastos aumentaron más rápido que tus ventas (${formatPercent(expensesChange, 0)} vs. ${formatPercent(salesChange, 0)}).`,
      href: "/dashboard/gastos",
    })
  }

  // Producto que vende mucho pero deja poca ganancia
  const withProfit = products.filter((p) => p.profit !== null && p.revenue > 0)
  const topSeller = [...withProfit].sort((a, b) => b.qty - a.qty)[0]
  if (topSeller && topSeller.qty >= 10) {
    const margin = topSeller.profit! / topSeller.revenue
    if (margin < 0.15) {
      tips.push({
        id: "low-margin",
        tone: "warning",
        text: `${topSeller.name} vende mucho, pero deja poca ganancia (${formatPercent(Math.max(0, margin), 0)} de margen). Revisa su precio.`,
        href: "/dashboard/herramientas/precio",
      })
    }
  }

  const mostProfitable = [...withProfit].sort((a, b) => b.profit! - a.profit!)[0]
  if (mostProfitable && mostProfitable.profit! > 0 && withProfit.length >= 3) {
    tips.push({
      id: "best-product",
      tone: "good",
      text: `${mostProfitable.name} es el producto que más ganancia te dejó en los últimos 30 días: ${money(mostProfitable.profit!)}.`,
    })
  }

  if (inventory.idleValue > 0 && inventory.idle.length > 0) {
    tips.push({
      id: "idle-stock",
      tone: "info",
      text: `Tienes ${money(inventory.idleValue)} inmovilizados en productos que no se vendieron en 30 días.`,
      href: "/dashboard/inventario",
    })
  }

  const reorder = inventory.low.length + inventory.out.length
  if (reorder > 0) {
    tips.push({
      id: "reorder",
      tone: "warning",
      text:
        reorder === 1
          ? "Tienes 1 producto agotado o por agotarse."
          : `Tienes ${reorder} productos agotados o por agotarse.`,
      href: "/dashboard/inventario?filtro=low",
    })
  }

  const topCategory = categories[0]
  if (topCategory && current.expenses > 0 && topCategory.total / current.expenses >= 0.4 && categories.length >= 2) {
    tips.push({
      id: "top-category",
      tone: "info",
      text: `El ${formatPercent(topCategory.total / current.expenses, 0)} de tus gastos del último mes se fue en ${topCategory.name}.`,
      href: "/dashboard/gastos",
    })
  }

  return tips
}
