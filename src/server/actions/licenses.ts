"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { idSchema } from "@/lib/validations"
import { requireAdmin } from "@/server/admin"
import { generateCodes, LicenseError, logLicense, markDelivered, voidCode } from "@/server/licenses"
import { mercadoLibre } from "@/server/mercadolibre"
import { processMlOrder, retryMlDeliveries, sendOrderCodes } from "@/server/ml-sales"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

// Panel de administración, sección Códigos (Plan Pro permanente). Solo administradores.

const generateSchema = z.object({
  count: z.number().int().min(1, "Mínimo 1").max(100, "Máximo 100 de una vez"),
  note: z.string().trim().max(200).optional(),
})

const orderIdSchema = z.string().regex(/^\d{1,20}$/, "Número de venta inválido")

function done(message: string): ActionResult {
  revalidatePath("/admin")
  return { ok: true, message }
}

function failed(error: unknown): ActionResult {
  if (error instanceof LicenseError) return { ok: false, message: error.message }
  return toActionError(error)
}

export async function generateActivationCodes(input: z.input<typeof generateSchema>): Promise<ActionResult<{ codes: string[] }>> {
  const admin = await requireAdmin()
  const parsed = generateSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  try {
    const codes = await generateCodes(parsed.data.count, { note: parsed.data.note, createdBy: admin.email })
    // Ventas que esperaban códigos: se entregan al tiro.
    const waiting = await db.mlOrder.findMany({ where: { pendingUnits: { gt: 0 }, reviewReason: null }, select: { id: true }, take: 20 })
    let delivered = 0
    for (const o of waiting) {
      try {
        const r = await processMlOrder(o.id, mercadoLibre, { retryDelaysMs: [0, 1_000] })
        if (r.result === "procesada") delivered += r.assigned
      } catch (error) {
        await logLicense(db, { kind: "error", mlOrderId: o.id, detail: `No se pudo entregar la venta pendiente ${o.id}: ${error instanceof Error ? error.message : String(error)}` })
      }
    }
    revalidatePath("/admin")
    return {
      ok: true,
      message: `${codes.length} ${codes.length === 1 ? "código creado" : "códigos creados"}${delivered ? `. Se entregaron ${delivered} a ventas que esperaban` : ""}`,
      data: { codes },
    }
  } catch (error) {
    return failed(error) as ActionResult<{ codes: string[] }>
  }
}

export async function voidActivationCode(id: string, reason?: string): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "No encontramos ese código." }
  try {
    const r = await voidCode(id, { by: admin.email, reason: reason?.slice(0, 200) })
    return done(r.downgraded ? `Código anulado. ${r.downgraded === 1 ? "El negocio volvió" : `${r.downgraded} negocios volvieron`} al plan Gratis` : "Código anulado")
  } catch (error) {
    return failed(error)
  }
}

export async function markActivationCodeSent(id: string, orderId?: string): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "No encontramos ese código." }
  const order = orderId?.trim() ? orderIdSchema.safeParse(orderId.trim()) : null
  if (order && !order.success) return { ok: false, message: "El número de venta solo lleva números." }
  try {
    await markDelivered(id, { by: admin.email, orderId: order?.success ? order.data : null })
    return done("Marcado como entregado")
  } catch (error) {
    return failed(error)
  }
}

export async function retryActivationCodeMessage(id: string): Promise<ActionResult> {
  await requireAdmin()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "No encontramos ese código." }
  try {
    const code = await db.activationCode.findUnique({ where: { id }, select: { mlOrderId: true, status: true, sentAt: true } })
    if (!code?.mlOrderId || code.status !== "RESERVED" || code.sentAt) return { ok: false, message: "Ese código no tiene un mensaje pendiente." }
    const r = await sendOrderCodes(code.mlOrderId, mercadoLibre, { retryDelaysMs: [0] })
    revalidatePath("/admin")
    return r.sent ? { ok: true, message: "Mensaje enviado al comprador" } : { ok: false, message: "Mercado Libre no aceptó el mensaje. Revisa el detalle del error en la lista." }
  } catch (error) {
    return failed(error)
  }
}

/** Vuelve a revisar una venta en Mercado Libre (por ejemplo, si quedó esperando el pago o sin código). */
export async function recheckMlOrder(orderId: string): Promise<ActionResult> {
  await requireAdmin()
  const parsed = orderIdSchema.safeParse(orderId.trim())
  if (!parsed.success) return { ok: false, message: "El número de venta solo lleva números." }
  try {
    const r = await processMlOrder(parsed.data, mercadoLibre, { retryDelaysMs: [0, 1_000] })
    await logLicense(db, { kind: "notificacion", mlOrderId: parsed.data, detail: `Revisada a mano desde el panel: ${r.result === "procesada" ? `${r.assigned} asignados, ${r.sent} enviados` : r.reason}` })
    revalidatePath("/admin")
    if (r.result === "procesada") {
      return { ok: true, message: r.pendingUnits ? `Faltan ${r.pendingUnits} códigos: genera más` : r.failed ? "Códigos asignados, pero el mensaje falló" : "Venta al día" }
    }
    return { ok: r.result !== "ignorada", message: r.reason }
  } catch (error) {
    return failed(error)
  }
}

/** Busca en Mercado Libre las ventas de los últimos 30 días que hayan quedado sin su código. */
export async function checkMlSalesNow(): Promise<ActionResult> {
  await requireAdmin()
  try {
    const r = await retryMlDeliveries(mercadoLibre, { days: 30, retryDelaysMs: [0, 1_000] })
    revalidatePath("/admin")
    if ("skipped" in r) return { ok: false, message: r.skipped }
    if ("error" in r) return { ok: false, message: `Mercado Libre no respondió: ${r.error}` }
    return { ok: true, message: `${r.revisadas} ${r.revisadas === 1 ? "venta revisada" : "ventas revisadas"}${r.recuperadas ? `, ${r.recuperadas} recuperadas` : ""}${r.sent ? `, ${r.sent} mensajes enviados` : ""}${r.errores ? `, ${r.errores} con error` : ""}` }
  } catch (error) {
    return failed(error)
  }
}

/** Quita el aviso de una venta cancelada o devuelta (después de revisarla). */
export async function dismissMlOrderReview(orderId: string): Promise<ActionResult> {
  const admin = await requireAdmin()
  const parsed = orderIdSchema.safeParse(orderId)
  if (!parsed.success) return { ok: false, message: "Venta no encontrada." }
  try {
    await db.mlOrder.update({ where: { id: parsed.data }, data: { reviewedAt: new Date() } })
    await logLicense(db, { kind: "revisar", mlOrderId: parsed.data, detail: `Aviso revisado por ${admin.email}` })
    return done("Aviso marcado como revisado")
  } catch (error) {
    return failed(error)
  }
}

export async function disconnectMercadoLibre(): Promise<ActionResult> {
  const admin = await requireAdmin()
  try {
    await db.mercadoLibreAccount.deleteMany({})
    await logLicense(db, { kind: "conexion", detail: `Cuenta de Mercado Libre desconectada por ${admin.email}` })
    return done("Mercado Libre desconectado")
  } catch (error) {
    return failed(error)
  }
}
