"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { isFoodBusiness } from "@/lib/business-kind"
import { canUseFeature } from "@/lib/plans"
import {
  comandaChargeSchema,
  comandaSchema,
  idSchema,
  type ComandaChargeInput,
  type ComandaInput,
} from "@/lib/validations"
import { applyStock, buildLines, FIADO_PRO, fiadoBlocked, lineData, MAX_TOTAL, resolveCustomer } from "@/server/sale-core"
import { assertCan, requireBusiness, type BusinessContext } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

function revalidate() {
  revalidatePath("/dashboard", "layout")
}

/** Solo negocios de comida con plan Pro (o Empresa). */
function blocked(ctx: BusinessContext) {
  if (!isFoodBusiness(ctx.business.type)) return "Las comandas son para restaurantes, cafés y negocios de comida. Puedes marcar ese rubro en Configuración."
  if (!canUseFeature(ctx.business.plan, "comandas")) return "Las comandas son parte del plan Pro."
  return null
}

/** Una comanda abierta de este negocio (las cobradas o anuladas ya no se tocan). */
async function findOpen(ctx: BusinessContext, id: string) {
  return db.comanda.findFirst({ where: { id, businessId: ctx.businessId, status: "OPEN" }, select: { id: true } })
}

/** Valida que los productos elegidos sean de este negocio. */
async function validProducts(ctx: BusinessContext, items: { productId?: string }[]) {
  const ids = [...new Set(items.map((i) => i.productId).filter((id): id is string => Boolean(id)))]
  if (!ids.length) return true
  const count = await db.product.count({ where: { businessId: ctx.businessId, id: { in: ids } } })
  return count === ids.length
}

export async function createComanda(input: ComandaInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusiness()
  const parsed = comandaSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  try {
    assertCan(ctx, "sales:create")
    const reason = blocked(ctx)
    if (reason) return { ok: false, message: reason }
    const { label, items } = parsed.data
    if (!(await validProducts(ctx, items))) return { ok: false, message: "Uno de los productos ya no existe. Recarga la página." }
    const comanda = await db.comanda.create({
      data: {
        businessId: ctx.businessId,
        label,
        createdById: ctx.user.id,
        items: { create: items.map((i) => ({ id: i.id, productId: i.productId || null, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, note: i.note })) },
      },
      select: { id: true },
    })
    revalidate()
    return { ok: true, message: "Comanda abierta", data: { id: comanda.id } }
  } catch (error) {
    return toActionError(error)
  }
}

/** Guarda el nombre y los productos de la comanda (reemplaza los que tenía). */
export async function saveComanda(id: string, input: ComandaInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = comandaSchema.safeParse(input)
  if (!parsed.success || !idSchema.safeParse(id).success) return parsed.success ? { ok: false, message: "Comanda no encontrada" } : validationError(parsed.error)
  try {
    assertCan(ctx, "sales:create")
    const reason = blocked(ctx)
    if (reason) return { ok: false, message: reason }
    if (!(await findOpen(ctx, id))) return { ok: false, message: "Esta comanda ya se cobró o se anuló. Recarga la página." }
    const { label, items } = parsed.data
    if (!(await validProducts(ctx, items))) return { ok: false, message: "Uno de los productos ya no existe. Recarga la página." }
    const existing = new Map((await db.comandaItem.findMany({ where: { comandaId: id } })).map((i) => [i.id, i]))
    const fresh = items.filter((i) => !existing.has(i.id))
    if (fresh.length && (await db.comandaItem.count({ where: { id: { in: fresh.map((i) => i.id) } } }))) {
      return { ok: false, message: "No se pudo guardar. Recarga la página." }
    }
    const keep = new Set(items.map((i) => i.id))
    await db.$transaction([
      db.comandaItem.deleteMany({ where: { comandaId: id, id: { notIn: [...keep] } } }),
      ...items
        .filter((i) => {
          const old = existing.get(i.id)
          return old && (old.quantity !== i.quantity || old.note !== (i.note ?? null) || old.unitPrice !== i.unitPrice || old.description !== i.description)
        })
        .map((i) =>
          db.comandaItem.update({
            where: { id: i.id },
            // Si bajan la cantidad, lo enviado y lo listo no pueden ser más que lo pedido.
            data: {
              quantity: i.quantity,
              note: i.note ?? null,
              unitPrice: i.unitPrice,
              description: i.description,
              sentQty: Math.min(existing.get(i.id)!.sentQty, i.quantity),
              readyQty: Math.min(existing.get(i.id)!.readyQty, i.quantity),
            },
          }),
        ),
      db.comanda.update({
        where: { id },
        data: {
          label,
          items: { create: fresh.map((i) => ({ id: i.id, productId: i.productId || null, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, note: i.note })) },
        },
      }),
    ])
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Comanda guardada" }
}

/** Cobra la comanda: crea una venta normal (descuenta stock, suma a la caja y a los reportes) y la cierra. */
export async function chargeComanda(id: string, input: ComandaChargeInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = comandaChargeSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Comanda no encontrada" }
  const { paymentMethod, customerName } = parsed.data
  try {
    assertCan(ctx, "sales:create")
    const reason = blocked(ctx)
    if (reason) return { ok: false, message: reason }
    if (fiadoBlocked(ctx, paymentMethod)) return { ok: false, message: FIADO_PRO }
    const comanda = await db.comanda.findFirst({
      where: { id, businessId: ctx.businessId, status: "OPEN" },
      include: { items: { orderBy: { createdAt: "asc" } } },
    })
    if (!comanda) return { ok: false, message: "Esta comanda ya se cobró o se anuló. Recarga la página." }
    if (!comanda.items.length) return { ok: false, message: "La comanda está vacía: agrega lo que pidieron." }
    if (comanda.items.length > 50) return { ok: false, message: "La comanda tiene demasiados productos." }
    const lines = await buildLines(
      ctx,
      comanda.items.map((i) => ({
        productId: i.productId ?? undefined,
        description: i.note ? `${i.description} (${i.note})`.slice(0, 120) : i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    )
    if (!lines) return { ok: false, message: "Uno de los productos ya no existe. Quítalo de la comanda y vuelve a cobrar." }
    const total = lines.reduce((sum, l) => sum + l.subtotal, 0)
    if (total <= 0) return { ok: false, message: "El total de la comanda debe ser mayor a 0." }
    if (total > MAX_TOTAL) return { ok: false, message: "El total de la comanda es demasiado alto." }

    await db.$transaction(async (tx) => {
      // Se cierra primero y solo si sigue abierta: si dos personas cobran a la vez, se cobra una sola vez.
      const closed = await tx.comanda.updateMany({ where: { id, status: "OPEN" }, data: { status: "PAID", closedAt: new Date() } })
      if (closed.count !== 1) throw new Error("ALREADY_CLOSED")
      const customerId = await resolveCustomer(tx, ctx.businessId, customerName)
      const sale = await tx.sale.create({
        data: {
          businessId: ctx.businessId,
          total,
          paymentMethod,
          note: comanda.label.slice(0, 200),
          customerId,
          createdById: ctx.user.id,
          items: { create: lines.map(lineData) },
        },
      })
      await applyStock(tx, ctx, sale.id, lines, `Venta (${comanda.label})`.slice(0, 120))
      await tx.comanda.update({ where: { id }, data: { saleId: sale.id } })
    })
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_CLOSED") return { ok: false, message: "Esta comanda ya se cobró. Recarga la página." }
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: paymentMethod === "FIADO" ? "Comanda cobrada al fiado" : "Comanda cobrada" }
}

/** Anula una comanda abierta (no se crea venta). */
export async function cancelComanda(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Comanda no encontrada" }
  try {
    assertCan(ctx, "sales:create")
    const reason = blocked(ctx)
    if (reason) return { ok: false, message: reason }
    const res = await db.comanda.updateMany({
      where: { id, businessId: ctx.businessId, status: "OPEN" },
      data: { status: "CANCELLED", closedAt: new Date() },
    })
    if (res.count !== 1) return { ok: false, message: "Esta comanda ya se cobró o se anuló." }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Comanda anulada" }
}

// ─── Cocina ─────────────────────────────────────────────────────────────────

/** El garzón envía a la cocina lo que todavía no se había enviado. */
export async function sendComandaToKitchen(id: string): Promise<ActionResult<{ sent: number }>> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Comanda no encontrada" }
  let sent = 0
  try {
    assertCan(ctx, "sales:create")
    const reason = blocked(ctx)
    if (reason) return { ok: false, message: reason }
    if (!(await findOpen(ctx, id))) return { ok: false, message: "Esta comanda ya se cobró o se anuló. Recarga la página." }
    const items = (await db.comandaItem.findMany({ where: { comandaId: id }, select: { id: true, quantity: true, sentQty: true } })).filter((i) => i.quantity > i.sentQty)
    if (!items.length) return { ok: false, message: "No hay nada nuevo para enviar a la cocina." }
    sent = items.reduce((sum, i) => sum + i.quantity - i.sentQty, 0)
    const sentAt = new Date()
    await db.$transaction(items.map((i) => db.comandaItem.update({ where: { id: i.id }, data: { sentQty: i.quantity, sentAt } })))
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Enviado a la cocina", data: { sent } }
}

/** La cocina marca un plato (o toda la mesa) como listo. undo = vuelve a dejarlo pendiente. */
export async function markKitchenReady(target: { itemId?: string; comandaId?: string }, undo = false): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const itemId = target.itemId && idSchema.safeParse(target.itemId).success ? target.itemId : undefined
  const comandaId = target.comandaId && idSchema.safeParse(target.comandaId).success ? target.comandaId : undefined
  if (!itemId && !comandaId) return { ok: false, message: "Plato no encontrado" }
  try {
    assertCan(ctx, "sales:create")
    const reason = blocked(ctx)
    if (reason) return { ok: false, message: reason }
    const items = await db.comandaItem.findMany({
      where: { ...(itemId ? { id: itemId } : { comandaId }), comanda: { businessId: ctx.businessId, status: "OPEN" } },
      select: { id: true, sentQty: true },
    })
    if (!items.length) return { ok: false, message: "Esta comanda ya se cobró o se anuló." }
    // Solo se marca listo lo que se envió a la cocina.
    await db.$transaction(items.map((i) => db.comandaItem.update({ where: { id: i.id }, data: { readyQty: undo ? 0 : i.sentQty } })))
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: undo ? "Vuelve a la cocina" : "Listo" }
}
