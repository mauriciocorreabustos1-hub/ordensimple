import "server-only"
import { db } from "@/lib/db"
import { addDays, startOfDay } from "@/lib/dates"

export type StockState = "ok" | "low" | "out"

export function stockStateOf(p: { stock: number; minStock: number }): StockState {
  if (p.stock <= 0) return "out"
  if (p.stock <= p.minStock) return "low"
  return "ok"
}

export async function getInventory(businessId: string, timezone: string, now = new Date()) {
  const since = addDays(startOfDay(now, timezone), -29, timezone)

  const [products, sold, movements] = await Promise.all([
    db.product.findMany({
      where: { businessId, active: true },
      select: { id: true, name: true, sku: true, stock: true, minStock: true, cost: true, price: true, trackStock: true },
      orderBy: { name: "asc" },
    }),
    db.saleItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, sale: { businessId, date: { gte: since } } },
      _sum: { quantity: true, subtotal: true },
    }),
    db.inventoryMovement.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        type: true,
        quantity: true,
        reason: true,
        createdAt: true,
        product: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ])

  const soldById = new Map(sold.map((s) => [s.productId!, { qty: s._sum.quantity ?? 0, revenue: s._sum.subtotal ?? 0 }]))
  const tracked = products.filter((p) => p.trackStock)

  const items = tracked.map((p) => ({
    ...p,
    state: stockStateOf(p),
    sold30: soldById.get(p.id)?.qty ?? 0,
  }))

  const value = tracked.reduce((s, p) => s + Math.max(0, p.stock) * p.cost, 0)
  const valueAtPrice = tracked.reduce((s, p) => s + Math.max(0, p.stock) * p.price, 0)
  const units = tracked.reduce((s, p) => s + Math.max(0, p.stock), 0)

  const topSellers = products
    .map((p) => ({ id: p.id, name: p.name, qty: soldById.get(p.id)?.qty ?? 0, revenue: soldById.get(p.id)?.revenue ?? 0 }))
    .filter((p) => p.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  // Productos con stock que no se vendieron en 30 días: dinero inmovilizado.
  const idle = items
    .filter((p) => p.stock > 0 && p.sold30 === 0)
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock, value: p.stock * p.cost }))
    .sort((a, b) => b.value - a.value)

  return {
    items,
    untrackedCount: products.length - tracked.length,
    value,
    valueAtPrice,
    units,
    low: items.filter((p) => p.state === "low"),
    out: items.filter((p) => p.state === "out"),
    topSellers,
    idle,
    idleValue: idle.reduce((s, p) => s + p.value, 0),
    movements,
    productOptions: products.map((p) => ({ id: p.id, name: p.name, stock: p.stock, trackStock: p.trackStock })),
  }
}
