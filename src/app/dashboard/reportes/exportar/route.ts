import { db } from "@/lib/db"
import { PAYMENT_LABEL } from "@/lib/constants"
import { getCurrency } from "@/lib/currency"
import { toDateKey, zonedParts } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { parseRange } from "@/server/queries/records"
import { requireBusiness } from "@/server/session"

// Descarga de ventas o gastos en CSV compatible con Excel en español
// (separador ";", decimales con coma y BOM para que respete los acentos).

function time24(date: Date, timezone: string) {
  const p = zonedParts(date, timezone)
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`
}

function cell(value: string | number | null | undefined) {
  const s = value === null || value === undefined ? "" : String(value)
  // Evita que Excel interprete el contenido como fórmula.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function GET(request: Request) {
  const ctx = await requireBusiness()
  if (!can(ctx.role, "reports:view") || !canUseFeature(ctx.business.plan, "exports")) {
    return new Response("No tienes acceso a los reportes.", { status: 403 })
  }

  const url = new URL(request.url)
  const type = url.searchParams.get("tipo") === "gastos" ? "gastos" : "ventas"
  const range = parseRange(
    { desde: url.searchParams.get("desde") ?? undefined, hasta: url.searchParams.get("hasta") ?? undefined },
    ctx.timezone,
  )
  const { decimals } = getCurrency(ctx.currency)
  const amount = (minor: number) => (minor / 10 ** decimals).toFixed(decimals).replace(".", ",")
  const where = { businessId: ctx.businessId, date: { gte: range.from, lt: range.to } }

  const rows: (string | number | null)[][] = []
  if (type === "ventas") {
    rows.push(["Fecha", "Hora", "Detalle", "Cliente", "Método de pago", `Total (${ctx.currency})`])
    const sales = await db.sale.findMany({
      where,
      orderBy: { date: "asc" },
      take: 50_000,
      select: {
        date: true,
        total: true,
        paymentMethod: true,
        customer: { select: { name: true } },
        items: { select: { description: true, quantity: true } },
      },
    })
    for (const s of sales) {
      rows.push([
        toDateKey(s.date, ctx.timezone),
        time24(s.date, ctx.timezone),
        s.items.map((i) => (i.quantity > 1 ? `${i.quantity} x ${i.description}` : i.description)).join(", "),
        s.customer?.name ?? "",
        PAYMENT_LABEL[s.paymentMethod],
        amount(s.total),
      ])
    }
  } else {
    rows.push(["Fecha", "Descripción", "Categoría", "Proveedor", `Monto (${ctx.currency})`])
    const expenses = await db.expense.findMany({
      where,
      orderBy: { date: "asc" },
      take: 50_000,
      select: {
        date: true,
        description: true,
        amount: true,
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    })
    for (const e of expenses) {
      rows.push([toDateKey(e.date, ctx.timezone), e.description, e.category?.name ?? "", e.supplier?.name ?? "", amount(e.amount)])
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
