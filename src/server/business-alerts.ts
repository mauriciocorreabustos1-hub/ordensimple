import "server-only"
import { canUseFeature, effectivePlan } from "@/lib/plans"
import { db } from "@/lib/db"
import { addDays, formatDate, startOfDay, startOfWeek, zonedParts } from "@/lib/dates"
import { sendEmailBatch } from "@/lib/email"
import { expiringEmail, lowStockEmail, noSalesEmail, payablesEmail, weeklyEmptyEmail, weeklySummaryEmail } from "@/lib/email-templates"
import { formatMoney } from "@/lib/currency"
import { payablesDueBefore } from "@/server/queries/payables"
import { totalsBetween } from "@/server/queries/aggregates"
import { getDebtors } from "@/server/queries/fiado"
import { productStats } from "@/server/queries/reports"

const DAY = 86_400_000
/** Días sin ventas antes de recordar, y cada cuánto se puede repetir el recordatorio. */
const NO_SALES_DAYS = 3
const NO_SALES_REPEAT_DAYS = 7
/** Negocios sin ventas hace más de esto se consideran inactivos: no se les insiste. */
const NO_SALES_MAX_DAYS = 45
/** Si los productos con stock bajo no cambian, el aviso se repite como máximo una vez por semana. */
const LOW_STOCK_REPEAT_DAYS = 7
const LOW_STOCK_MAX_ITEMS = 8
/** Productos por vencer: se avisa lo que vence en los próximos 7 días; si no cambia, se repite cada 3 días. */
const EXPIRY_DAYS = 7
const EXPIRY_REPEAT_DAYS = 3
const EXPIRY_MAX_ITEMS = 8

type Email = Parameters<typeof sendEmailBatch>[0][number]

/**
 * Avisos por correo según lo que cada negocio activó en Configuración:
 * resumen semanal (los lunes), stock bajo y días sin ventas.
 * Se ejecuta una vez al día (Vercel Cron). Llegan al dueño y a los administradores.
 */
export async function sendBusinessAlerts(now = new Date()) {
  const businesses = await db.business.findMany({
    where: { onboardingCompleted: true, settings: { isNot: null } },
    select: {
      id: true,
      name: true,
      currency: true,
      timezone: true,
      plan: true,
      planExpiresAt: true,
      settings: true,
      members: {
        where: { role: { in: ["OWNER", "ADMIN"] } },
        select: { user: { select: { name: true, email: true } } },
      },
    },
  })

  const emails: Email[] = []
  const counts = { weekly: 0, lowStock: 0, noSales: 0, payables: 0, expiring: 0 }

  for (const b of businesses) {
    const s = b.settings!
    const recipients = b.members.map((m) => m.user)
    if (recipients.length === 0) continue
    const tz = b.timezone
    const today = startOfDay(now, tz)

    // ─── Resumen semanal: todos los lunes, sí o sí, de la semana anterior (lunes a domingo) ──
    // Llega siempre (no depende de la opción de Configuración); si la semana estuvo vacía, invita a anotar.
    const p = zonedParts(now, tz)
    const isMonday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() === 1
    if (isMonday && (!s.lastWeeklySummaryAt || s.lastWeeklySummaryAt < today)) {
      const thisWeek = startOfWeek(now, tz)
      const from = addDays(thisWeek, -7, tz)
      const prevFrom = addDays(thisWeek, -14, tz)
      const [week, prev, stats, debts, products] = await Promise.all([
        totalsBetween(b.id, from, thisWeek),
        totalsBetween(b.id, prevFrom, from),
        productStats(b.id, from, thisWeek),
        getDebtors(b.id),
        db.product.findMany({ where: { businessId: b.id, active: true, trackStock: true }, select: { stock: true, minStock: true } }),
      ])
      await db.businessSettings.update({ where: { id: s.id }, data: { lastWeeklySummaryAt: now } })
      const lastDay = addDays(thisWeek, -1, tz)
      const weekLabel = `${formatDate(from, tz, { day: "numeric", month: "long" })} al ${formatDate(lastDay, tz, { day: "numeric", month: "long" })}`
      if (week.sales === 0 && week.expenses === 0) {
        for (const r of recipients) {
          emails.push({
            to: r.email,
            ...weeklyEmptyEmail({ name: r.name, businessName: b.name, weekLabel, currency: b.currency, debtTotal: debts.total, debtCount: debts.count }),
          })
        }
        counts.weekly++
      } else {
        const topProducts = [...stats].sort((a, c) => c.qty - a.qty).slice(0, 3).map((x) => ({ name: x.name, qty: x.qty }))
        for (const r of recipients) {
          emails.push({
            to: r.email,
            ...weeklySummaryEmail({
              name: r.name,
              businessName: b.name,
              weekLabel,
              currency: b.currency,
              sales: week.sales,
              salesCount: week.salesCount,
              expenses: week.expenses,
              profit: week.profit,
              prevSales: prev.sales,
              topProducts,
              debtTotal: debts.total,
              debtCount: debts.count,
              lowStockCount: products.filter((x) => x.stock <= x.minStock || x.stock <= 0).length,
            }),
          })
        }
        counts.weekly++
      }
    }

    // ─── Stock bajo: solo si cambió la lista o pasó una semana ────────────────
    if (s.lowStockAlerts && canUseFeature(effectivePlan(b), "inventory")) {
      const low = await db.product.findMany({
        where: { businessId: b.id, active: true, trackStock: true },
        select: { id: true, name: true, stock: true, minStock: true },
        orderBy: { stock: "asc" },
      })
      const items = low.filter((x) => x.stock <= 0 || x.stock <= x.minStock)
      const key = items.length ? items.map((x) => `${x.id}:${x.stock <= 0 ? "out" : "low"}`).sort().join(",") : null
      const stale = !s.lastLowStockAlertAt || now.getTime() - s.lastLowStockAlertAt.getTime() >= LOW_STOCK_REPEAT_DAYS * DAY
      if (key && (key !== s.lowStockAlertKey || stale)) {
        await db.businessSettings.update({ where: { id: s.id }, data: { lowStockAlertKey: key, lastLowStockAlertAt: now } })
        const shown = items.slice(0, LOW_STOCK_MAX_ITEMS).map((x) => ({ name: x.name, stock: x.stock }))
        for (const r of recipients) {
          emails.push({ to: r.email, ...lowStockEmail({ name: r.name, businessName: b.name, items: shown, more: items.length - shown.length }) })
        }
        counts.lowStock++
      } else if (!key && s.lowStockAlertKey) {
        // Ya repuso todo: la próxima vez que algo se acabe, avisamos al tiro.
        await db.businessSettings.update({ where: { id: s.id }, data: { lowStockAlertKey: null } })
      }
    }

    // ─── Productos por vencer (Merma y vencidos, plan Pro) ───────────────────
    if (s.expiryAlerts && canUseFeature(effectivePlan(b), "waste")) {
      const soon = await db.product.findMany({
        where: { businessId: b.id, active: true, expiresAt: { not: null, lt: addDays(today, EXPIRY_DAYS + 1, tz) } },
        select: { id: true, name: true, stock: true, trackStock: true, price: true, expiresAt: true },
        orderBy: { expiresAt: "asc" },
      })
      // Solo lo que todavía se puede vender (con stock, o sin control de stock).
      const items = soon.filter((x) => !x.trackStock || x.stock > 0)
      const key = items.length ? items.map((x) => `${x.id}:${x.expiresAt!.toISOString().slice(0, 10)}`).sort().join(",") : null
      const stale = !s.lastExpiryAlertAt || now.getTime() - s.lastExpiryAlertAt.getTime() >= EXPIRY_REPEAT_DAYS * DAY
      if (key && (key !== s.expiryAlertKey || stale)) {
        await db.businessSettings.update({ where: { id: s.id }, data: { expiryAlertKey: key, lastExpiryAlertAt: now } })
        const shown = items.slice(0, EXPIRY_MAX_ITEMS).map((x) => ({
          name: x.name,
          units: x.trackStock ? x.stock : null,
          value: x.trackStock ? Math.max(0, x.stock) * x.price : 0,
          days: Math.round((startOfDay(x.expiresAt!, tz).getTime() - today.getTime()) / DAY),
        }))
        for (const r of recipients) {
          emails.push({ to: r.email, ...expiringEmail({ name: r.name, businessName: b.name, currency: b.currency, items: shown, more: items.length - shown.length }) })
        }
        counts.expiring++
      } else if (!key && s.expiryAlertKey) {
        await db.businessSettings.update({ where: { id: s.id }, data: { expiryAlertKey: null } })
      }
    }

    // ─── Días sin ventas (solo negocios que ya venían registrando) ───────────
    if (s.noSalesReminder) {
      const last = await db.sale.findFirst({ where: { businessId: b.id }, orderBy: { date: "desc" }, select: { date: true } })
      if (last) {
        const days = Math.floor((today.getTime() - startOfDay(last.date, tz).getTime()) / DAY)
        const remindedAfterLastSale = s.lastNoSalesReminderAt && s.lastNoSalesReminderAt > last.date
        const recentlyReminded = s.lastNoSalesReminderAt && now.getTime() - s.lastNoSalesReminderAt.getTime() < NO_SALES_REPEAT_DAYS * DAY
        if (days >= NO_SALES_DAYS && days <= NO_SALES_MAX_DAYS && !(remindedAfterLastSale && recentlyReminded)) {
          await db.businessSettings.update({ where: { id: s.id }, data: { lastNoSalesReminderAt: now } })
          for (const r of recipients) emails.push({ to: r.email, ...noSalesEmail({ name: r.name, businessName: b.name, days }) })
          counts.noSales++
        }
      }
    }

    // ─── Pagos a proveedores: los que vencen hoy o mañana, y los atrasados (cada 3 días) ──
    const dueSoon = await payablesDueBefore(b.id, addDays(today, 2, tz))
    const toRemind = dueSoon.filter((x) => {
      const overdue = x.dueDate < today
      const last = x.remindedAt
      return overdue ? !last || now.getTime() - last.getTime() >= 3 * DAY : !last || last < today
    })
    if (toRemind.length) {
      const items = toRemind.map((x) => {
        const days = Math.round((startOfDay(x.dueDate, tz).getTime() - today.getTime()) / DAY)
        return {
          description: x.description,
          supplier: x.supplier?.name ?? null,
          amount: formatMoney(x.amount, b.currency),
          when: days < 0 ? `venció hace ${-days} día${days === -1 ? "" : "s"}` : days === 0 ? "vence hoy" : "vence mañana",
          overdue: days < 0,
        }
      })
      await db.payable.updateMany({ where: { id: { in: toRemind.map((x) => x.id) } }, data: { remindedAt: now } })
      for (const r of recipients) emails.push({ to: r.email, ...payablesEmail({ name: r.name, businessName: b.name, items }) })
      counts.payables++
    }
  }

  const result = emails.length ? await sendEmailBatch(emails) : { sent: 0, failed: 0 }
  return { businesses: businesses.length, ...counts, ...result }
}
