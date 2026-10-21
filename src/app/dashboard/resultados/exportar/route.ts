import { formatMoney, getCurrency } from "@/lib/currency"
import { PdfReport, pdfResponse } from "@/server/pdf"
import { formatDate, zonedParts, zonedTimeToUtc } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { vatInfo } from "@/lib/vat"
import { getYearSummary } from "@/server/queries/results"
import { requireBusiness } from "@/server/session"

// Resumen del año (estado de resultados mes a mes) en CSV compatible con Excel en español
// (separador ";", decimales con coma y BOM para que respete los acentos).

function cell(value: string | number) {
  const s = String(value)
  // Evita que Excel interprete texto como fórmula (los números negativos sí se dejan como número).
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-\d+(,\d+)?$/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function GET(request: Request) {
  const ctx = await requireBusiness()
  if (!can(ctx.role, "reports:view") || !canUseFeature(ctx.business.plan, "exports")) {
    return new Response("No tienes acceso a los reportes.", { status: 403 })
  }

  const today = zonedParts(new Date(), ctx.timezone)
  const asked = Number(new URL(request.url).searchParams.get("anio"))
  const year = Number.isInteger(asked) && asked >= 2000 && asked <= today.year ? asked : today.year
  const lastMonth = year === today.year ? today.month : 12

  const vat = vatInfo(ctx.business.country)
  const chargesVat = Boolean(vat && ctx.settings.chargesVat)
  const L = vat?.label ?? "IVA"
  const { rows, totals } = await getYearSummary(ctx.businessId, year, lastMonth, ctx.timezone, chargesVat ? vat!.rate : null)

  // Los meses vacíos antes de empezar a registrar no se incluyen.
  const first = rows.findIndex((r) => r.s.sales !== 0 || r.s.costOfSales !== 0 || r.s.operatingExpenses !== 0 || r.s.purchasesToInventory !== 0)
  const visible = first < 0 ? rows : rows.slice(first)

  const monthLabel = (m: number) => formatDate(zonedTimeToUtc(year, m, 1, ctx.timezone), ctx.timezone, { month: "long" })

  // PDF: el estado de resultados del año, mes a mes, listo para imprimir o mandar al contador.
  if (new URL(request.url).searchParams.get("formato") === "pdf") {
    const money = (n: number) => formatMoney(n, ctx.currency)
    const report = await PdfReport.create({
      businessName: ctx.business.name,
      title: `Estado de resultados ${year}`,
      subtitle: chargesVat ? `Mes a mes, con el ${L} de cada mes` : "Mes a mes",
      generated: formatDate(new Date(), ctx.timezone, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      landscape: true,
    })
    report.kpis([
      { label: chargesVat ? `Ventas sin ${L}` : "Ventas", value: money(totals.netSales) },
      { label: "Costo de venta", value: money(totals.costOfSales) },
      { label: "Gastos", value: money(totals.operatingExpenses) },
      { label: totals.profit >= 0 ? "Utilidad del año" : "Pérdida del año", value: money(totals.profit), tone: totals.profit < 0 ? "bad" : "good" },
    ])
    const cols = chargesVat
      ? [
          { label: "Mes", width: 1.6 },
          { label: "Ventas totales", width: 1.5, align: "right" as const },
          { label: `${L} ventas`, width: 1.3, align: "right" as const },
          { label: `Ventas sin ${L}`, width: 1.5, align: "right" as const },
          { label: "Costo de venta", width: 1.4, align: "right" as const },
          { label: "Utilidad bruta", width: 1.4, align: "right" as const },
          { label: "Gastos", width: 1.3, align: "right" as const },
          { label: "Utilidad", width: 1.4, align: "right" as const },
          { label: `${L} a pagar`, width: 1.3, align: "right" as const },
        ]
      : [
          { label: "Mes", width: 1.6 },
          { label: "Ventas", width: 1.5, align: "right" as const },
          { label: "Costo de venta", width: 1.5, align: "right" as const },
          { label: "Utilidad bruta", width: 1.5, align: "right" as const },
          { label: "Gastos", width: 1.5, align: "right" as const },
          { label: "Utilidad", width: 1.5, align: "right" as const },
        ]
    type V = { sales: number; salesVat: number; netSales: number; costOfSales: number; grossProfit: number; operatingExpenses: number; profit: number; waste?: number }
    const pdfLine = (label: string, v: V, vatToPay: number) =>
      chargesVat
        ? [label, money(v.sales), money(v.salesVat), money(v.netSales), money(v.costOfSales), money(v.grossProfit), money(v.operatingExpenses + (v.waste ?? 0)), money(v.profit), money(vatToPay)]
        : [label, money(v.netSales), money(v.costOfSales), money(v.grossProfit), money(v.operatingExpenses + (v.waste ?? 0)), money(v.profit)]
    report.heading("Mes a mes")
    report.table(cols, visible.map((r) => pdfLine(monthLabel(r.month), r.s, r.vatToPay)), { total: pdfLine(`Total ${year}`, totals, totals.vatToPay) })
    report.paragraph(
      `Cálculo aproximado hecho con OrdenSimple con lo que registraste. Para tu declaración${vat?.form ? ` (${vat.form})` : ""}, revisa las cifras con tu contador.`,
    )
    return pdfResponse(await report.save(), `ordensimple-resultados-${year}.pdf`)
  }

  const { decimals } = getCurrency(ctx.currency)
  const amount = (minor: number) => (minor / 10 ** decimals).toFixed(decimals).replace(".", ",")

  const header = chargesVat
    ? ["Mes", "Ventas totales", `${L} de las ventas`, `Ventas sin ${L}`, "Costo de venta", "Utilidad bruta", "Gastos", "Utilidad", `${L} a pagar`]
    : ["Mes", "Ventas", "Costo de venta", "Utilidad bruta", "Gastos", "Utilidad"]
  const line = (label: string, v: { sales: number; salesVat: number; netSales: number; costOfSales: number; grossProfit: number; operatingExpenses: number; profit: number; waste?: number }, vatToPay: number) =>
    chargesVat
      ? [label, amount(v.sales), amount(v.salesVat), amount(v.netSales), amount(v.costOfSales), amount(v.grossProfit), amount(v.operatingExpenses + (v.waste ?? 0)), amount(v.profit), amount(vatToPay)]
      : [label, amount(v.netSales), amount(v.costOfSales), amount(v.grossProfit), amount(v.operatingExpenses + (v.waste ?? 0)), amount(v.profit)]

  const data = [
    [`Estado de resultados ${year} — ${ctx.business.name}`],
    [],
    header,
    ...visible.map((r) => line(formatDate(zonedTimeToUtc(year, r.month, 1, ctx.timezone), ctx.timezone, { month: "long" }), r.s, r.vatToPay)),
    line(`Total ${year}`, totals, totals.vatToPay),
    [],
    ["Cálculo aproximado hecho con OrdenSimple. Para tu declaración, revisa las cifras con tu contador o el SII."],
  ]
  const csv = "﻿" + data.map((r) => r.map(cell).join(";")).join("\r\n")
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ordensimple-resultados-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
