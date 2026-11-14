"use server"

import { lineTotal, roundQuantity, validQuantity } from "@/lib/units"
import { revalidatePath } from "next/cache"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { after } from "next/server"
import { db } from "@/lib/db"
import { formatMoney } from "@/lib/currency"
import { businessManagers, sendPush } from "@/server/push"
import { canApproveDiscounts } from "@/lib/roles"
import { idSchema, returnRequestSchema, type ReturnRequestInput } from "@/lib/validations"
import type { Tx } from "@/server/sale-core"
import { assertCan, PermissionError, requireBusiness, type BusinessContext } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

/** Los empleados piden devoluciones de ventas de los últimos 30 días; el dueño y los administradores, de cualquier fecha. */
const EMPLOYEE_DAYS = 30

type ReturnItem = { saleItemId: string; productId: string | null; description: string; quantity: number; unitPrice: number; unit?: string }

function revalidate() {
  revalidatePath("/dashboard", "layout")
}

/** Venta original con sus productos y lo que ya se devolvió (o está pedido) de cada uno. */
async function loadSale(ctx: BusinessContext, saleId: string) {
  const sale = await db.sale.findFirst({
    where: { id: saleId, businessId: ctx.businessId, returnOfId: null },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      customer: { select: { name: true } },
      returnRequests: { where: { status: { in: ["PENDING", "APPROVED"] } }, select: { items: true, status: true } },
    },
  })
  if (!sale) return null
  const taken = new Map<string, number>()
  let pending = false
  for (const r of sale.returnRequests) {
    if (r.status === "PENDING") pending = true
    for (const i of r.items as ReturnItem[]) taken.set(i.saleItemId, (taken.get(i.saleItemId) ?? 0) + i.quantity)
  }
  const itemsSubtotal = sale.items.reduce((s, i) => s + i.subtotal, 0)
  // Si la venta tuvo descuento, lo que se devuelve lleva el mismo descuento.
  const ratio = itemsSubtotal > 0 ? sale.total / itemsSubtotal : 1
  return { sale, taken, pending, ratio }
}

export type ReturnableSale = {
  saleId: string
  date: string
  paymentMethod: PaymentMethod
  customerName: string | null
  total: number
  ratio: number
  tooOld: boolean
  hasPending: boolean
  items: { saleItemId: string; description: string; unitPrice: number; sold: number; available: number; unit: string }[]
}

/** Lo que se puede devolver de una venta (para la ventana de devolución). */
export async function getReturnable(saleId: string): Promise<ActionResult<ReturnableSale>> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(saleId).success) return { ok: false, message: "Venta no encontrada." }
  try {
    assertCan(ctx, "sales:create")
    const loaded = await loadSale(ctx, saleId)
    if (!loaded) return { ok: false, message: "Venta no encontrada." }
    const { sale, taken, pending, ratio } = loaded
    const tooOld = !canApproveDiscounts(ctx.role) && sale.date.getTime() < Date.now() - EMPLOYEE_DAYS * 86_400_000
    return {
      ok: true,
      data: {
        saleId: sale.id,
        date: sale.date.toISOString(),
        paymentMethod: sale.paymentMethod,
        customerName: sale.customer?.name ?? null,
        total: sale.total,
        ratio,
        tooOld,
        hasPending: pending,
        items: sale.items.map((i) => ({
          saleItemId: i.id,
          description: i.description,
          unitPrice: i.unitPrice,
          sold: i.quantity,
          available: Math.max(0, roundQuantity(i.quantity - (taken.get(i.id) ?? 0), i.unit)),
          unit: i.unit,
        })),
      },
    }
  } catch (error) {
    return toActionError(error)
  }
}

class ReturnConflict extends Error {}

/**
 * Dentro de la transacción: bloquea la venta original (otra devolución de la misma venta espera su turno) y revisa
 * que cada producto siga existiendo con el mismo precio y que no se devuelva más de lo vendido.
 * `exclude` es la solicitud que se está aprobando (no se cuenta contra sí misma).
 */
async function assertAvailable(tx: Tx, saleId: string, items: ReturnItem[], exclude?: string) {
  await tx.$queryRaw`SELECT "id" FROM "sale" WHERE "id" = ${saleId} FOR UPDATE`
  const [saleItems, others] = await Promise.all([
    tx.saleItem.findMany({ where: { saleId }, select: { id: true, quantity: true, unitPrice: true } }),
    tx.saleReturn.findMany({ where: { saleId, status: { in: ["PENDING", "APPROVED"] }, ...(exclude ? { id: { not: exclude } } : {}) }, select: { items: true } }),
  ])
  const taken = new Map<string, number>()
  for (const r of others) for (const i of r.items as ReturnItem[]) taken.set(i.saleItemId, (taken.get(i.saleItemId) ?? 0) + i.quantity)
  const byId = new Map(saleItems.map((i) => [i.id, i]))
  // Se suman las cantidades de esta misma solicitud por producto (por si viniera repetido).
  const asked = new Map<string, number>()
  for (const i of items) {
    const it = byId.get(i.saleItemId)
    if (!it || it.unitPrice !== i.unitPrice) throw new ReturnConflict("La venta cambió desde que se pidió la devolución. Pídela de nuevo.")
    asked.set(i.saleItemId, (asked.get(i.saleItemId) ?? 0) + i.quantity)
    if (asked.get(i.saleItemId)! > it.quantity - (taken.get(i.saleItemId) ?? 0) + 1e-9) throw new ReturnConflict(`De “${i.description}” ya no se pueden devolver tantas unidades.`)
  }
}

/** Registra la devolución aprobada: venta en negativo hoy, stock de vuelta (o merma) y fiado rebajado si corresponde. */
async function applyReturn(tx: Tx, ctx: BusinessContext, ret: { id: string; saleId: string; items: ReturnItem[]; amount: number; reason: string; refundMethod: PaymentMethod; restock: boolean; requestedById: string }) {
  const original = await tx.sale.findUniqueOrThrow({ where: { id: ret.saleId }, include: { items: true } })
  const byId = new Map(original.items.map((i) => [i.id, i]))
  const returnSale = await tx.sale.create({
    data: {
      businessId: ctx.businessId,
      total: -ret.amount,
      paymentMethod: ret.refundMethod,
      customerId: original.customerId,
      note: `Devolución · ${ret.reason}`.slice(0, 200),
      returnOfId: original.id,
      createdById: ret.requestedById,
      items: {
        create: ret.items.map((i) => ({
          productId: i.productId,
          description: i.description,
          quantity: -i.quantity,
          unit: byId.get(i.saleItemId)?.unit ?? "u",
          unitPrice: i.unitPrice,
          unitCost: byId.get(i.saleItemId)?.unitCost ?? 0,
          subtotal: -lineTotal(i.quantity, i.unitPrice),
        })),
      },
    },
  })
  for (const i of ret.items) {
    if (!i.productId) continue
    const product = await tx.product.findFirst({ where: { id: i.productId, businessId: ctx.businessId }, select: { trackStock: true, cost: true } })
    if (!product?.trackStock) continue
    if (ret.restock) {
      await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } })
      await tx.inventoryMovement.create({
        data: { businessId: ctx.businessId, productId: i.productId, type: "IN", quantity: i.quantity, reason: "Devolución", saleId: returnSale.id, createdById: ctx.user.id },
      })
    } else {
      // Vino dañado: no vuelve al stock y se anota como pérdida (merma) al costo.
      await tx.inventoryMovement.create({
        data: {
          businessId: ctx.businessId,
          productId: i.productId,
          type: "WASTE",
          quantity: -i.quantity,
          unitCost: byId.get(i.saleItemId)?.unitCost || product.cost,
          reason: `Devolución dañada: ${ret.reason}`.slice(0, 120),
          createdById: ctx.user.id,
        },
      })
    }
  }
  await tx.saleReturn.update({ where: { id: ret.id }, data: { returnSaleId: returnSale.id } })
}

/** Pide (empleado) o hace directo (dueño o administrador) una devolución. */
export async function requestReturn(input: ReturnRequestInput): Promise<ActionResult<{ applied: boolean }>> {
  const ctx = await requireBusiness()
  const parsed = returnRequestSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { saleId, reason, refundMethod, restock } = parsed.data
  try {
    assertCan(ctx, "sales:create")
    const loaded = await loadSale(ctx, saleId)
    if (!loaded) return { ok: false, message: "Venta no encontrada." }
    const { sale, taken, ratio } = loaded
    const approver = canApproveDiscounts(ctx.role)
    if (!approver && sale.date.getTime() < Date.now() - EMPLOYEE_DAYS * 86_400_000) {
      return { ok: false, message: `Solo se pueden devolver ventas de los últimos ${EMPLOYEE_DAYS} días. Pídele al encargado.` }
    }
    if (refundMethod === "FIADO" && (sale.paymentMethod !== "FIADO" || !sale.customerId)) {
      return { ok: false, message: "Solo se puede rebajar del fiado si la venta fue fiada." }
    }
    const byId = new Map(sale.items.map((i) => [i.id, i]))
    const items: ReturnItem[] = []
    for (const r of parsed.data.items) {
      const it = byId.get(r.saleItemId)
      if (!it) return { ok: false, message: "Uno de los productos no es de esta venta. Recarga la página." }
      if (!validQuantity(r.quantity, it.unit)) return { ok: false, message: it.unit === "u" ? `“${it.description}” se devuelve por unidad: usa una cantidad entera.` : `La cantidad de “${it.description}” no es válida.` }
      if (r.quantity > it.quantity - (taken.get(it.id) ?? 0) + 1e-9) return { ok: false, message: `De “${it.description}” no se pueden devolver tantas unidades.` }
      items.push({ saleItemId: it.id, productId: it.productId, description: it.description, quantity: r.quantity, unitPrice: it.unitPrice, unit: it.unit })
    }
    const amount = Math.round(items.reduce((s, i) => s + lineTotal(i.quantity, i.unitPrice), 0) * ratio)
    if (amount <= 0) return { ok: false, message: "No hay nada que devolver." }

    const base = {
      businessId: ctx.businessId,
      saleId,
      items,
      amount,
      reason,
      refundMethod,
      restock,
      requestedById: ctx.user.id,
      requestedByName: ctx.user.name,
    }
    if (!approver) {
      await db.$transaction(async (tx) => {
        await assertAvailable(tx, saleId, items)
        await tx.saleReturn.create({ data: base })
      })
      revalidate()
      after(async () =>
        sendPush(await businessManagers(ctx.businessId, ctx.user.id), {
          title: `↩️ ${ctx.user.name.split(" ")[0]} pide una devolución`,
          body: `${formatMoney(amount, ctx.currency)} · ${base.reason}`,
          url: "/dashboard",
          tag: `devolucion-${saleId}`,
        }),
      )
      return { ok: true, message: "Devolución pedida: el encargado debe aprobarla.", data: { applied: false } }
    }
    await db.$transaction(async (tx) => {
      await assertAvailable(tx, saleId, items)
      const ret = await tx.saleReturn.create({
        data: { ...base, status: "APPROVED", decidedById: ctx.user.id, decidedByName: ctx.user.name, decidedAt: new Date() },
      })
      await applyReturn(tx, ctx, { ...ret, items })
    })
  } catch (error) {
    if (error instanceof ReturnConflict) return { ok: false, message: error.message }
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Devolución registrada", data: { applied: true } }
}

export type PendingReturn = {
  id: string
  requestedByName: string
  amount: number
  reason: string
  refundMethod: PaymentMethod
  restock: boolean
  items: { description: string; quantity: number }[]
  saleDate: string
  createdAt: string
}

/** Devoluciones esperando respuesta (solo para el dueño y los administradores). */
export async function listPendingReturns(): Promise<ActionResult<PendingReturn[]>> {
  const ctx = await requireBusiness()
  if (!canApproveDiscounts(ctx.role)) return { ok: true, data: [] }
  const rows = await db.saleReturn.findMany({
    where: { businessId: ctx.businessId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 10,
    include: { sale: { select: { date: true } } },
  })
  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      requestedByName: r.requestedByName,
      amount: r.amount,
      reason: r.reason,
      refundMethod: r.refundMethod,
      restock: r.restock,
      items: (r.items as ReturnItem[]).map((i) => ({ description: i.description, quantity: i.quantity })),
      saleDate: r.sale.date.toISOString(),
      createdAt: r.createdAt.toISOString(),
    })),
  }
}

/** El dueño o un administrador aprueba (se registra al tiro) o rechaza una devolución. */
export async function decideReturn(id: string, approve: boolean): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Solicitud no encontrada" }
  try {
    if (!canApproveDiscounts(ctx.role)) throw new PermissionError()
    const done = await db.$transaction(async (tx) => {
      // Solo una vez: si dos encargados responden a la vez, gana el primero.
      const res = await tx.saleReturn.updateMany({
        where: { id, businessId: ctx.businessId, status: "PENDING" },
        data: { status: approve ? "APPROVED" : "REJECTED", decidedById: ctx.user.id, decidedByName: ctx.user.name, decidedAt: new Date() },
      })
      if (res.count !== 1) return false
      if (approve) {
        const ret = await tx.saleReturn.findUniqueOrThrow({ where: { id } })
        // Se vuelve a revisar justo al aprobar: la venta pudo cambiar, o pudo aprobarse otra devolución.
        await assertAvailable(tx, ret.saleId, ret.items as ReturnItem[], ret.id)
        await applyReturn(tx, ctx, { ...ret, items: ret.items as ReturnItem[] })
      }
      return true
    })
    if (!done) return { ok: false, message: "Esta devolución ya fue respondida." }
  } catch (error) {
    if (error instanceof ReturnConflict) return { ok: false, message: error.message }
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: approve ? "Devolución aprobada y registrada" : "Devolución rechazada" }
}
