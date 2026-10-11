import { formatDate, formatDateTime } from "@/lib/dates"
import { effectivePlan, PLANS } from "@/lib/plans"
import { ROLE_LABEL } from "@/lib/roles"
import { device } from "@/lib/activity-format"
import { requireAdmin } from "@/server/admin"
import { ACTIVITY_FILTERS, getBusinessActivity, listAdminUsers, ROLE_FILTERS, type ActivityFilter, type RoleFilter } from "@/server/queries/admin"

// Lista de usuarios en CSV para Excel (separador ";" y BOM para los acentos), con los filtros del panel.
const TZ = "America/Santiago"

function cell(value: string | number | null | undefined) {
  const s = value === null || value === undefined ? "" : String(value)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function GET(request: Request) {
  await requireAdmin()
  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim().slice(0, 100) || undefined
  const a = url.searchParams.get("actividad")
  const r = url.searchParams.get("rol")
  const activity = (ACTIVITY_FILTERS.some((x) => x.value === a) ? a : "todos") as ActivityFilter
  const role = (ROLE_FILTERS.some((x) => x.value === r) ? r : "todos") as RoleFilter

  const { rows } = await listAdminUsers({ q, page: 1, activity, role, all: true })
  const usage = await getBusinessActivity([...new Set(rows.flatMap((u) => (u.memberships[0] ? [u.memberships[0].business.id] : [])))])
  const now = new Date()

  const lines: (string | number | null)[][] = [
    [
      "Nombre",
      "Correo",
      "Registro",
      "Última vez activo",
      "Equipo",
      "Rol",
      "Negocio",
      "Rubro",
      "Plan",
      "Plan vence",
      "Personas en el negocio",
      "Productos",
      "Ventas totales",
      "Última venta",
      "Ventas últimos 30 días",
      "Monto últimos 30 días",
      "Días con ventas (30)",
      "Producto estrella (90 días)",
      "Acepta promociones",
      "Notas internas",
      "Llegó por",
      "Campaña",
    ],
  ]
  for (const u of rows) {
    const m = u.memberships[0]
    const b = m?.business
    const act = b ? usage.get(b.id) : undefined
    const seen = u.lastActiveAt ?? u.sessions[0]?.updatedAt
    lines.push([
      u.name,
      u.email,
      formatDate(u.createdAt, TZ, { day: "2-digit", month: "2-digit", year: "numeric" }),
      seen ? formatDateTime(seen, TZ) : "Nunca",
      device(u.sessions[0]?.userAgent),
      m ? ROLE_LABEL[m.role] : "Sin negocio",
      b?.name ?? "",
      b?.type ?? "",
      b ? PLANS[effectivePlan(b, now)].name : "",
      b && b.plan !== "FREE" && b.planExpiresAt ? formatDate(b.planExpiresAt, TZ, { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
      b?._count.members ?? "",
      b?._count.products ?? "",
      b?._count.sales ?? "",
      act?.lastSaleAt ? formatDate(act.lastSaleAt, TZ, { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
      act?.sales30 ?? "",
      act?.total30 ?? "",
      act?.days30 ?? "",
      act?.bestProduct?.name ?? "",
      u.marketingOptIn ? "Sí" : "No",
      u._count.adminNotes || "",
      u.signupSource ?? "",
      u.signupCampaign ?? "",
    ])
  }

  const csv = "﻿" + lines.map((l) => l.map(cell).join(";")).join("\r\n")
  const date = formatDate(now, TZ, { year: "numeric", month: "2-digit", day: "2-digit" }).split("-").reverse().join("-")
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="usuarios-ordensimple-${date.replaceAll("/", "-")}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
