"use server"

import { db } from "@/lib/db"
import { canApproveDiscounts } from "@/lib/roles"
import { discountRequestSchema, idSchema, type DiscountRequestInput } from "@/lib/validations"
import { DISCOUNT_VALID_MS } from "@/server/sale-core"
import { assertCan, PermissionError, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

/** Solicitudes recientes (las viejas ya no se pueden usar ni aprobar). */
const recent = () => ({ gte: new Date(Date.now() - DISCOUNT_VALID_MS) })

export type DiscountStatusView = { status: "PENDING" | "APPROVED" | "REJECTED" | "USED" | "EXPIRED"; decidedByName: string | null }

/** Un trabajador pide un descuento; el dueño o un administrador lo verá para aprobarlo. */
export async function requestDiscount(input: DiscountRequestInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusiness()
  const parsed = discountRequestSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { amount, subtotal, reason, context } = parsed.data
  if (amount >= subtotal) return { ok: false, message: "El descuento no puede ser igual o mayor que el total." }
  try {
    assertCan(ctx, "sales:create")
    // Que no se acumulen solicitudes sin responder de la misma persona.
    const pending = await db.discountRequest.count({
      where: { businessId: ctx.businessId, requestedById: ctx.user.id, status: "PENDING", createdAt: recent() },
    })
    if (pending >= 3) return { ok: false, message: "Tienes solicitudes de descuento sin responder. Espera a que el encargado las revise." }
    const r = await db.discountRequest.create({
      data: { businessId: ctx.businessId, requestedById: ctx.user.id, requestedByName: ctx.user.name, amount, subtotal, reason, context },
      select: { id: true },
    })
    return { ok: true, data: { id: r.id } }
  } catch (error) {
    return toActionError(error)
  }
}

/** Estado de una solicitud: la consulta quien la pidió (o un encargado). */
export async function getDiscountStatus(id: string): Promise<ActionResult<DiscountStatusView>> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Solicitud no encontrada" }
  const r = await db.discountRequest.findFirst({
    where: { id, businessId: ctx.businessId, ...(canApproveDiscounts(ctx.role) ? {} : { requestedById: ctx.user.id }) },
    select: { status: true, decidedByName: true, createdAt: true },
  })
  if (!r) return { ok: false, message: "Solicitud no encontrada" }
  const expired = (r.status === "PENDING" || r.status === "APPROVED") && r.createdAt.getTime() < Date.now() - DISCOUNT_VALID_MS
  return { ok: true, data: { status: expired ? "EXPIRED" : r.status, decidedByName: r.decidedByName } }
}

/** Quien pidió el descuento lo retira (por ejemplo, porque cambió el monto). */
export async function withdrawDiscount(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Solicitud no encontrada" }
  try {
    await db.discountRequest.deleteMany({ where: { id, businessId: ctx.businessId, requestedById: ctx.user.id, status: { in: ["PENDING", "APPROVED"] } } })
  } catch (error) {
    return toActionError(error)
  }
  return { ok: true }
}

export type PendingDiscount = {
  id: string
  requestedByName: string
  amount: number
  subtotal: number
  reason: string
  context: string
  createdAt: string
}

/** Descuentos esperando respuesta (solo para el dueño y los administradores). */
export async function listPendingDiscounts(): Promise<ActionResult<PendingDiscount[]>> {
  const ctx = await requireBusiness()
  if (!canApproveDiscounts(ctx.role)) return { ok: true, data: [] }
  const rows = await db.discountRequest.findMany({
    where: { businessId: ctx.businessId, status: "PENDING", createdAt: recent() },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { id: true, requestedByName: true, amount: true, subtotal: true, reason: true, context: true, createdAt: true },
  })
  return { ok: true, data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) }
}

/** El dueño o un administrador aprueba o rechaza un descuento. */
export async function decideDiscount(id: string, approve: boolean): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Solicitud no encontrada" }
  try {
    if (!canApproveDiscounts(ctx.role)) throw new PermissionError()
    const res = await db.discountRequest.updateMany({
      where: { id, businessId: ctx.businessId, status: "PENDING", createdAt: recent() },
      data: { status: approve ? "APPROVED" : "REJECTED", decidedById: ctx.user.id, decidedByName: ctx.user.name, decidedAt: new Date() },
    })
    if (res.count !== 1) return { ok: false, message: "Esta solicitud ya fue respondida o venció." }
  } catch (error) {
    return toActionError(error)
  }
  return { ok: true, message: approve ? "Descuento aprobado" : "Descuento rechazado" }
}
