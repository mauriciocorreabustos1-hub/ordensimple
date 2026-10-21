import { db } from "@/lib/db"
import { PAYMENT_LABEL } from "@/lib/constants"
import { formatMoney, formatNumber, formatPercent, getCurrency } from "@/lib/currency"
import { addDays, formatDate, toDateKey, zonedParts } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { parseRange } from "@/server/queries/records"
import { getReport } from "@/server/queries/reports"
import { PdfReport, pdfResponse } from "@/server/pdf"
import { requireBusiness, type BusinessContext } from "@/server/session"

// Descargas de Reportes:
// - Excel: ventas o gastos en CSV compatible con Excel en español (separador ";", decimales con coma y BOM para los acentos).
// - PDF: el resumen del período, o el detalle de ventas o gastos, listos para imprimir o mandar.

function time24(date: Date, timezone: string) {
  const p = zonedParts(date, timezone)
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`
}

function cell(value: string | number | null | undefined) {
  const s = value === null || value === undefined ? "" : String(value)
  // Evita que Excel interprete el contenido como fórmula.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** El PDF tiene un tope de filas para no generar archivos gigantes; el Excel trae todo. */
const PDF_MAX_ROWS = 3000

type SaleRow = { date: Date; detail: string; customer: string; method: string; total: number }
type ExpenseRow = { date: Date; description: string; category: string; supplier: string; amount: number }

async function salesIn(ctx: BusinessContext, from: Date, to: Date, take: number): Promise<SaleRow[]> {
  const sales = await db.sale.findMany({
    where: { businessId: ctx.businessId, date: { gte: from, lt: to } },
    orderBy: { date: "asc" },
    take,
    select: {
      date: true,
      total: true,
      paymentMethod: true,
      returnOfId: true,
      customer: { select: { name: true } },
      items: { select: { description: true, quantity: true } },
    },
  })
  return sales.map((s) => {
    const items = s.items.map((i) => `${Math.abs(i.quantity) > 1 ? `${Math.abs(i.quantity)} x ` : ""}${i.description}`).join(", ")
    return {
      date: s.date,
      detail: s.returnOfId ? `Devolución: ${items}` : items || "Venta rápida",
      customer: s.customer?.name ?? "",
      method: PAYMENT_LABEL[s.paymentMethod],
      total: s.total,
    }
  })
}

async function expensesIn(ctx: BusinessContext, from: Date, to: Date, take: number): Promise<ExpenseRow[]> {
  const expenses = await db.expense.findMany({
    where: { businessId: ctx.businessId, date: { gte: from, lt: to } },
    orderBy: { date: "asc" },
    take,
    select: { date: true, description: true, amount: true, category: { select: { name: true } }, supplier: { select: { name: true } } },
  })
  return expenses.map((e) => ({ date: e.date, description: e.description, category: e.category?.name ?? "", supplier: e.supplier?.name ?? "", amount: e.amount }))
}

export async function GET(request: Request) {
  const ctx = await requireBusiness()
  if (!can(ctx.role, "reports:view") || !canUseFeature(ctx.business.plan, "exports")) {
    return new Response("No tienes acceso a los reportes.", { status: 403 })
  }

  const url = new URL(request.url)
  const tipo = url.searchParams.get("tipo")
  const type = tipo === "gastos" ? "gastos" : tipo === "resumen" ? "resumen" : "ventas"
  const pdf = url.searchParams.get("formato") === "pdf" || type === "resumen"
  const range = parseRange(
    { desde: url.searchParams.get("desde") ?? undefined, hasta: url.searchParams.get("hasta") ?? undefined },
    ctx.timezone,
  )

  if (pdf) return pdfExport(ctx, type, range)

  const { decimals } = getCurrency(ctx.currency)
  const amount = (minor: number) => (minor / 10 ** decimals).toFixed(decimals).replace(".", ",")
  const rows: (string | number | null)[][] = []
  if (type === "ventas") {
    rows.push(["Fecha", "Hora", "Detalle", "Cliente", "Método de pago", `Total (${ctx.currency})`])
    for (const s of await salesIn(ctx, range.from, range.to, 50_000)) {
      rows.push([toDateKey(s.date, ctx.timezone), time24(s.date, ctx.timezone), s.detail, s.customer, s.method, amount(s.total)])
    }
  } else {
    rows.push(["Fecha", "Descripción", "Categoría", "Proveedor", `Monto (${ctx.currency})`])
    for (const e of await expensesIn(ctx, range.from, range.to, 50_000)) {
      rows.push([toDateKey(e.date, ctx.timezone), e.description, e.category, e.supplier, amount(e.amount)])
    }
  }

  const csv = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n")
  const filename = `ordensimple-${type}-${range.desde}-a-${range.hasta}.csv`
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

async function pdfExport(ctx: BusinessContext, type: "ventas" | "gastos" | "resumen", range: ReturnType<typeof parseRange>) {
  const money = (n: number) => formatMoney(n, ctx.currency)
  const tz = ctx.timezone
  const last = addDays(range.to, -1, tz)
  const period = `Del ${formatDate(range.from, tz, { day: "numeric", month: "long", year: "numeric" })} al ${formatDate(last, tz, { day: "numeric", month: "long", year: "numeric" })}`
  const generated = formatDate(new Date(), tz, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
  const title = type === "resumen" ? "Reporte del período" : type === "ventas" ? "Detalle de ventas" : "Detalle de gastos"
  const report = await PdfReport.create({ businessName: ctx.business.name, title, subtitle: period, generated })
  const day = (d: Date) => formatDate(d, tz, { day: "2-digit", month: "2-digit", year: "numeric" })

  if (type === "resumen") {
    const r = await getReport(ctx.businessId, range.from, range.to, tz)
    const { current: cur, previous: prev } = r
    const change = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${formatPercent((a - b) / Math.abs(b), 0)} vs. período anterior` : "Sin datos del período anterior")
    report.kpis([
      { label: "Vendiste", value: money(cur.sales), sub: change(cur.sales, prev.sales) },
      { label: "Gastaste", value: money(cur.expenses), sub: change(cur.expenses, prev.expenses) },
      { label: cur.profit >= 0 ? "Te quedó (aprox.)" : "Perdiste (aprox.)", value: money(Math.abs(cur.profit)), sub: `Antes: ${money(prev.profit)}`, tone: cur.profit < 0 ? "bad" : "good" },
      {
        label: "Ventas",
        value: formatNumber(cur.salesCount),
        sub: cur.salesCount ? `Promedio ${money(Math.round(cur.sales / cur.salesCount))} c/u` : "Sin ventas",
      },
    ])
    report.paragraph(
      cur.sales <= 0
        ? "No hay ventas en estas fechas."
        : cur.profit >= 0
          ? `Por cada ${money(10_000)} que vendiste, te quedaron ${money(Math.round((cur.profit / cur.sales) * 10_000))} después de los gastos.`
          : `Gastaste más de lo que vendiste: por cada ${money(10_000)} de ventas, los gastos fueron ${money(Math.round((cur.expenses / cur.sales) * 10_000))}.`,
      { color: "ink" },
    )
    report.heading(r.weekly ? "Ventas y gastos por semana" : "Ventas y gastos por día")
    report.table(
      [
        { label: r.weekly ? "Semana" : "Día", width: 3 },
        { label: "Ventas", width: 2, align: "right" },
        { label: "Gastos", width: 2, align: "right" },
        { label: "Diferencia", width: 2, align: "right" },
      ],
      r.chart.filter((p) => p.sales || p.expenses).map((p) => [p.fullLabel, money(p.sales), money(p.expenses), money(p.sales - p.expenses)]),
      { total: ["Total", money(cur.sales), money(cur.expenses), money(cur.profit)], empty: "No hay ventas ni gastos en este período." },
    )
    report.heading("Productos más vendidos")
    report.table(
      [
        { label: "Producto", width: 5 },
        { label: "Unidades", width: 1.5, align: "right" },
        { label: "Ventas", width: 2, align: "right" },
      ],
      r.topByQty.map((p) => [p.name, formatNumber(p.qty), money(p.revenue)]),
      { empty: "No hay ventas con detalle de productos." },
    )
    report.heading("Productos más rentables", "Lo que te dejó cada producto después de pagar su costo.")
    report.table(
      [
        { label: "Producto", width: 5 },
        { label: "Ganancia", width: 2, align: "right" },
        { label: "Margen", width: 1.5, align: "right" },
      ],
      r.topByProfit.map((p) => [p.name, money(p.profit), formatPercent(p.revenue ? p.profit / p.revenue : 0, 0)]),
      { empty: "Registra ventas de productos con su costo para ver esto." },
    )
    report.heading("Gastos por categoría")
    report.table(
      [
        { label: "Categoría", width: 5 },
        { label: "Monto", width: 2, align: "right" },
        { label: "% del total", width: 1.5, align: "right" },
      ],
      r.categories.map((c) => [c.name, money(c.total), formatPercent(cur.expenses ? c.total / cur.expenses : 0, 0)]),
      { empty: "No hay gastos en este período." },
    )
    report.heading("¿Cómo te pagaron?")
    report.table(
      [
        { label: "Medio de pago", width: 5 },
        { label: "Ventas", width: 1.5, align: "right" },
        { label: "Monto", width: 2, align: "right" },
      ],
      r.payments.map((p) => [PAYMENT_LABEL[p.method], formatNumber(p.count), money(p.total)]),
      { empty: "No hay ventas en este período." },
    )
    report.paragraph("Cifras aproximadas calculadas con lo que registraste en OrdenSimple. Para tu declaración de impuestos, revísalas con tu contador.")
  } else if (type === "ventas") {
    const rows = await salesIn(ctx, range.from, range.to, PDF_MAX_ROWS + 1)
    const shown = rows.slice(0, PDF_MAX_ROWS)
    const sum = shown.reduce((s, x) => s + x.total, 0)
    report.kpis([
      { label: "Total vendido", value: money(sum) },
      { label: "Ventas", value: formatNumber(shown.filter((s) => s.total >= 0).length) },
    ])
    report.table(
      [
        { label: "Fecha", width: 1.25 },
        { label: "Hora", width: 0.7 },
        { label: "Detalle", width: 4 },
        { label: "Cliente", width: 1.7 },
        { label: "Pago", width: 1.3 },
        { label: "Total", width: 1.4, align: "right" },
      ],
      shown.map((s) => [day(s.date), time24(s.date, tz), s.detail, s.customer, s.method, money(s.total)]),
      { total: ["Total", "", "", "", "", money(sum)], empty: "No hay ventas en este período." },
    )
    if (rows.length > PDF_MAX_ROWS) report.paragraph(`Se muestran las primeras ${formatNumber(PDF_MAX_ROWS)} ventas. Para verlas todas, descarga el Excel.`)
  } else {
    const rows = await expensesIn(ctx, range.from, range.to, PDF_MAX_ROWS + 1)
    const shown = rows.slice(0, PDF_MAX_ROWS)
    const sum = shown.reduce((s, x) => s + x.amount, 0)
    report.kpis([
      { label: "Total gastado", value: money(sum) },
      { label: "Gastos", value: formatNumber(shown.length) },
    ])
    report.table(
      [
        { label: "Fecha", width: 1.25 },
        { label: "Descripción", width: 3.6 },
        { label: "Categoría", width: 2 },
        { label: "Proveedor", width: 1.9 },
        { label: "Monto", width: 1.5, align: "right" },
      ],
      shown.map((e) => [day(e.date), e.description, e.category, e.supplier, money(e.amount)]),
      { total: ["Total", "", "", "", money(sum)], empty: "No hay gastos en este período." },
    )
    if (rows.length > PDF_MAX_ROWS) report.paragraph(`Se muestran los primeros ${formatNumber(PDF_MAX_ROWS)} gastos. Para verlos todos, descarga el Excel.`)
  }

  return pdfResponse(await report.save(), `ordensimple-${type}-${range.desde}-a-${range.hasta}.pdf`)
}
