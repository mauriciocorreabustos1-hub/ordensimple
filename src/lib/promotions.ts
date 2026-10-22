import { zonedParts } from "@/lib/dates"

// Promociones automáticas: el mismo cálculo se usa en el celular (para mostrar el total al tiro)
// y en el servidor (que es el que vale al guardar). A cada producto se le aplica la mejor promoción que le toque.

export type PromoRule = {
  id: string
  name: string
  kind: "PERCENT" | "BUY_X_PAY_Y"
  percent: number | null
  buyQty: number | null
  payQty: number | null
  scope: string
  productIds: string[]
  categoryId: string | null
  startsAt: string | Date | null
  endsAt: string | Date | null
  weekdays: number[]
  fromMinute: number | null
  toMinute: number | null
  inStore: boolean
  online: boolean
}

export type PromoLine = { key: string | number; productId: string | null; categoryId: string | null; quantity: number; unitPrice: number }
export type AppliedPromo = { promotionId: string; name: string; amount: number }

export const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

/** ¿La promoción está vigente en este momento (fechas, día de la semana y horario)? */
export function promoActive(rule: PromoRule, now: Date, timezone: string) {
  if (rule.startsAt && new Date(rule.startsAt) > now) return false
  if (rule.endsAt && new Date(rule.endsAt) <= now) return false
  const p = zonedParts(now, timezone)
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
  if (rule.weekdays.length && !rule.weekdays.includes(weekday)) return false
  if (rule.fromMinute !== null && rule.toMinute !== null) {
    const minute = p.hour * 60 + p.minute
    // Un horario que cruza la medianoche (22:00 a 02:00) también vale.
    const inside = rule.fromMinute <= rule.toMinute ? minute >= rule.fromMinute && minute < rule.toMinute : minute >= rule.fromMinute || minute < rule.toMinute
    if (!inside) return false
  }
  return true
}

function matches(rule: PromoRule, productId: string, categoryId: string | null) {
  if (rule.scope === "PRODUCTS") return rule.productIds.includes(productId)
  if (rule.scope === "CATEGORY") return Boolean(categoryId) && rule.categoryId === categoryId
  return true
}

/** Lo que descuenta una promoción sobre cierta cantidad de un producto. */
export function promoAmount(rule: PromoRule, quantity: number, unitPrice: number) {
  if (quantity <= 0 || unitPrice <= 0) return 0
  if (rule.kind === "PERCENT") return Math.round((quantity * unitPrice * Math.min(100, Math.max(0, rule.percent ?? 0))) / 100)
  const buy = rule.buyQty ?? 0
  const pay = rule.payQty ?? 0
  if (buy < 2 || pay < 0 || pay >= buy) return 0
  return Math.floor(quantity / buy) * (buy - pay) * unitPrice
}

/** Texto corto para mostrar en una etiqueta: "2×1", "−20 %". */
export function promoBadge(rule: Pick<PromoRule, "kind" | "percent" | "buyQty" | "payQty">) {
  return rule.kind === "PERCENT" ? `−${rule.percent} %` : `${rule.buyQty}×${rule.payQty}`
}

/**
 * Aplica las promociones vigentes a las líneas de una venta. Las líneas del mismo producto y precio se suman
 * (para que "2 × 1" funcione aunque se hayan agregado por separado), y a cada producto le toca la mejor promoción.
 */
export function applyPromotions(
  lines: PromoLine[],
  rules: PromoRule[],
  opts: { now: Date; timezone: string; channel: "store" | "online" },
): { discount: number; applied: AppliedPromo[]; byKey: Map<string | number, { promotionId: string; name: string; amount: number }> } {
  const active = rules.filter((r) => (opts.channel === "online" ? r.online : r.inStore) && promoActive(r, opts.now, opts.timezone))
  const byKey = new Map<string | number, { promotionId: string; name: string; amount: number }>()
  const totals = new Map<string, AppliedPromo>()
  if (!active.length) return { discount: 0, applied: [], byKey }

  const groups = new Map<string, { key: string | number; productId: string; categoryId: string | null; quantity: number; unitPrice: number }>()
  for (const l of lines) {
    if (!l.productId || l.quantity <= 0) continue
    const id = `${l.productId}:${l.unitPrice}`
    const g = groups.get(id)
    if (g) g.quantity += l.quantity
    else groups.set(id, { key: l.key, productId: l.productId, categoryId: l.categoryId, quantity: l.quantity, unitPrice: l.unitPrice })
  }
  for (const g of groups.values()) {
    let best: { rule: PromoRule; amount: number } | null = null
    for (const r of active) {
      if (!matches(r, g.productId, g.categoryId)) continue
      const amount = Math.min(promoAmount(r, g.quantity, g.unitPrice), g.quantity * g.unitPrice)
      if (amount > 0 && (!best || amount > best.amount)) best = { rule: r, amount }
    }
    if (!best) continue
    byKey.set(g.key, { promotionId: best.rule.id, name: best.rule.name, amount: best.amount })
    const t = totals.get(best.rule.id)
    if (t) t.amount += best.amount
    else totals.set(best.rule.id, { promotionId: best.rule.id, name: best.rule.name, amount: best.amount })
  }
  const applied = [...totals.values()]
  return { discount: applied.reduce((s, a) => s + a.amount, 0), applied, byKey }
}

/**
 * Para promociones "lleva X, paga Y": qué le falta al cliente para aprovecharla.
 * Ej.: 2×1 con 1 unidad → "Agrega 1 más y te sale gratis". Null si ya la aprovecha completa.
 */
export function promoHint(rule: Pick<PromoRule, "kind" | "buyQty" | "payQty">, quantity: number) {
  if (rule.kind !== "BUY_X_PAY_Y" || !rule.buyQty || rule.payQty === null || quantity <= 0) return null
  const rest = quantity % rule.buyQty
  if (rest === 0) return null
  const missing = rule.buyQty - rest
  const free = rule.buyQty - rule.payQty
  // Si lo que falta es justo lo que sale gratis, agregarlo no cuesta nada.
  if (missing <= free) return `Agrega ${missing} más y ${missing === 1 ? "te sale gratis" : "te salen gratis"}`
  return `Lleva ${missing} más y ${free === 1 ? "1 te sale gratis" : `${free} te salen gratis`}`
}
