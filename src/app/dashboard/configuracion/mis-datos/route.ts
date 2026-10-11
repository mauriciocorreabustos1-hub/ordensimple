import { db } from "@/lib/db"
import { PAYMENT_LABEL } from "@/lib/constants"
import { getCurrency } from "@/lib/currency"
import { toDateKey, zonedParts } from "@/lib/dates"
import { ROLE_LABEL } from "@/lib/roles"
import { createZip } from "@/lib/zip"
import { requireUser } from "@/server/session"

// "Descargar mis datos": un ZIP con planillas CSV (se abren en Excel) de la cuenta y de cada negocio
// del que la persona es dueña. Formato igual a la exportación de reportes: ";" y decimales con coma.

function cell(value: string | number | boolean | null | undefined) {
  const s = value === null || value === undefined ? "" : typeof value === "boolean" ? (value ? "Sí" : "No") : String(value)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s // evita que Excel lo tome como fórmula
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
function csv(header: string[], rows: (string | number | boolean | null | undefined)[][]) {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n")
}
function slug(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "negocio"
  )
}

export async function GET() {
  const user = await requireUser()
  const account = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      createdAt: true,
      marketingOptIn: true,
      termsAcceptedAt: true,
      memberships: { select: { role: true, business: { select: { id: true, name: true, timezone: true, currency: true } } } },
    },
  })

  const files: { name: string; content: string }[] = []
  files.push({
    name: "mi-cuenta.csv",
    content: csv(
      ["Nombre", "Correo", "Cuenta creada", "Aceptó términos", "Acepta ofertas por correo"],
      [[account.name, account.email, account.createdAt.toISOString(), account.termsAcceptedAt?.toISOString() ?? "", account.marketingOptIn]],
    ),
  })
  files.push({
    name: "mis-negocios.csv",
    content: csv(["Negocio", "Mi rol"], account.memberships.map((m) => [m.business.name, ROLE_LABEL[m.role]])),
  })

  const owned = account.memberships.filter((m) => m.role === "OWNER").map((m) => m.business)
  const used = new Set<string>()
  for (const b of owned) {
    let folder = slug(b.name)
    while (used.has(folder)) folder += "-2"
    used.add(folder)
    const tz = b.timezone
    const { decimals } = getCurrency(b.currency)
    const money = (minor: number | null | undefined) => (minor === null || minor === undefined ? "" : (minor / 10 ** decimals).toFixed(decimals).replace(".", ","))
    const day = (d: Date) => toDateKey(d, tz)
    const time = (d: Date) => {
      const p = zonedParts(d, tz)
      return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`
    }
    const where = { businessId: b.id }

    const [sales, items, expenses, products, customers, payments, suppliers, closings, movements, team] = await Promise.all([
      db.sale.findMany({ where, orderBy: { date: "asc" }, include: { customer: { select: { name: true } } } }),
      db.saleItem.findMany({ where: { sale: where }, orderBy: { createdAt: "asc" }, include: { sale: { select: { date: true } } } }),
      db.expense.findMany({ where, orderBy: { date: "asc" }, include: { category: { select: { name: true } }, supplier: { select: { name: true } } } }),
      db.product.findMany({ where, orderBy: { name: "asc" }, include: { category: { select: { name: true } } } }),
      db.customer.findMany({ where, orderBy: { name: "asc" } }),
      db.customerPayment.findMany({ where, orderBy: { date: "asc" }, include: { customer: { select: { name: true } } } }),
      db.supplier.findMany({ where, orderBy: { name: "asc" } }),
      db.cashClosing.findMany({ where, orderBy: { day: "asc" } }),
      db.inventoryMovement.findMany({ where, orderBy: { createdAt: "asc" }, include: { product: { select: { name: true } } } }),
      db.businessMember.findMany({ where, include: { user: { select: { name: true, email: true } } } }),
    ])

    const add = (name: string, header: string[], rows: (string | number | boolean | null | undefined)[][]) =>
      files.push({ name: `${folder}/${name}`, content: csv(header, rows) })

    add("ventas.csv", ["Fecha", "Hora", "Total", "Forma de pago", "Cliente", "Nota", "Código"], sales.map((s) => [day(s.date), time(s.date), money(s.total), PAYMENT_LABEL[s.paymentMethod], s.customer?.name, s.note, s.id]))
    add("detalle-ventas.csv", ["Fecha", "Código de venta", "Producto o descripción", "Cantidad", "Precio unitario", "Costo unitario", "Subtotal"], items.map((i) => [day(i.sale.date), i.saleId, i.description, i.quantity, money(i.unitPrice), money(i.unitCost), money(i.subtotal)]))
    add("gastos.csv", ["Fecha", "Monto", "Categoría", "Descripción", "Proveedor"], expenses.map((e) => [day(e.date), money(e.amount), e.category?.name, e.description, e.supplier?.name]))
    add("productos.csv", ["Nombre", "Código (SKU)", "Categoría", "Costo", "Precio", "Stock", "Stock mínimo", "Controla stock", "Activo"], products.map((p) => [p.name, p.sku, p.category?.name, money(p.cost), money(p.price), p.stock, p.minStock, p.trackStock, p.active]))
    add("clientes.csv", ["Nombre", "Teléfono", "Correo", "Notas"], customers.map((c) => [c.name, c.phone, c.email, c.notes]))
    add("abonos-fiado.csv", ["Fecha", "Cliente", "Monto", "Forma de pago", "Nota"], payments.map((p) => [day(p.date), p.customer.name, money(p.amount), PAYMENT_LABEL[p.paymentMethod], p.note]))
    add("proveedores.csv", ["Nombre", "Teléfono", "Correo", "Productos", "Costo de despacho", "Notas"], suppliers.map((s) => [s.name, s.phone, s.email, s.products, money(s.deliveryCost), s.notes]))
    add("cierres-de-caja.csv", ["Día", "Efectivo inicial", "Ventas en efectivo", "Abonos en efectivo", "Gastos pagados con caja", "Debería haber", "Contado", "Diferencia", "Nota"], closings.map((c) => [c.day, money(c.opening), money(c.cashSales), money(c.cashIn), money(c.cashOut), money(c.expected), money(c.counted), money(c.difference), c.note]))
    add("movimientos-inventario.csv", ["Fecha", "Producto", "Tipo", "Cantidad", "Motivo"], movements.map((m) => [day(m.createdAt), m.product.name, m.type, m.quantity, m.reason]))
    add("equipo.csv", ["Nombre", "Correo", "Rol"], team.map((t) => [t.user.name, t.user.email, ROLE_LABEL[t.role]]))
  }

  files.push({
    name: "LEEME.txt",
    content:
      "Tus datos de OrdenSimple\r\n========================\r\n\r\n" +
      "Cada archivo .csv se abre con Excel, Google Sheets o Numbers.\r\n" +
      "Los montos están en la moneda de cada negocio, con coma decimal.\r\n" +
      "Hay una carpeta por cada negocio del que eres dueño.\r\n\r\n" +
      `Descargado el ${new Date().toISOString().slice(0, 10)}.\r\n`,
  })

  const zip = createZip(files)
  const filename = `ordensimple-mis-datos-${new Date().toISOString().slice(0, 10)}.zip`
  return new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
