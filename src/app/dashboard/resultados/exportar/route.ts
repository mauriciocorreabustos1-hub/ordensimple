import { getCurrency } from "@/lib/currency"
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
  const safe = /^[=+\-@]/.test(s) && !/^-\d+(,\d+)?$/.test(s) ? `'${s}` : s
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

  const { decimals } = getCurrency(ctx.currency)
  const amount = (minor: number) => (minor / 10 ** decimals).toFixed(decimals).replace(".", ",")

  const header = chargesVat
    ? ["Mes", "Ventas totales", `${L} de las ventas`, `Ventas sin ${L}`, "Costo de venta", "Utilidad bruta", "Gastos", "Utilidad", `${L} a pagar`]
    : ["Mes", "Ventas", "Costo de venta", "Utilidad bruta", "Gastos", "Utilidad"]
  const line = (label: string, v: { sales: number; salesVat: number; netSales: number; costOfSales: number; grossProfit: number; operatingExpenses: number; profit: number }, vatToPay: number) =>
    chargesVat
      ? [label, amount(v.sales), amount(v.salesVat), amount(v.netSales), amount(v.costOfSales), amount(v.grossProfit), amount(v.operatingExpenses), amount(v.profit), amount(vatToPay)]
      : [label, amount(v.netSales), amount(v.costOfSales), amount(v.grossProfit), amount(v.operatingExpenses), amount(v.profit)]

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
