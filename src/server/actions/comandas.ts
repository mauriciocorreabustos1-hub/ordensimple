"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { sendPush } from "@/server/push"
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
import {
  applyStock,
  buildLines,
  checkDiscount,
  customItemsBlocked,
  DISCOUNT_USED_MESSAGE,
  FIADO_PRO,
  fiadoBlocked,
  isDiscountUsed,
  lineData,
  MAX_TOTAL,
  priceBelowList,
  resolveCustomer,
  linkPromotions,
  promotionsFor,
} from "@/server/sale-core"
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
    const custom = customItemsBlocked(ctx, items)
    if (custom) return { ok: false, message: custom }
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
    const custom = customItemsBlocked(ctx, items)
    if (custom) return { ok: false, message: custom }
    if (!(await validProducts(ctx, items))) return { ok: false, message: "Uno de los productos ya no existe. Recarga la página." }
    const existing = new Map((await db.comandaItem.findMany({ where: { comandaId: id } })).map((i) => [i.id, i]))
    const fresh = items.filter((i) => !existing.has(i.id))
    if (fresh.length && (await db.comandaItem.count({ where: { id: { in: fresh.map((i) => i.id) } } }))) {
      return { ok: false, message: "No se pudo guardar. Recarga la página." }
    }
    const keep = new Set(items.map((i) => i.id))
    // Lo ya pagado no se puede quitar ni cambiar de precio (ya es una venta).
    const touchesPaid = items.some((i) => {
      const old = existing.get(i.id)
      return old && old.paidQty > 0 && (i.quantity < old.paidQty || old.unitPrice !== i.unitPrice || old.description !== i.description)
    })
    if (touchesPaid || [...existing.values()].some((o) => o.paidQty > 0 && !keep.has(o.id))) {
      return { ok: false, message: "No puedes quitar ni cambiar lo que ya se pagó. Recarga la página." }
    }
    await db.$transaction([
      db.comandaItem.deleteMany({ where: { comandaId: id, id: { notIn: [...keep] }, paidQty: 0 } }),
      ...items
        .filter((i) => {
          const old = existing.get(i.id)
          return old && (old.quantity !== i.quantity || old.note !== (i.note ?? null) || old.unitPrice !== i.unitPrice || old.description !== i.description)
        })
        .map((i) =>
          // Solo si nadie cobró parte entretanto (el cobro revisa lo mismo al revés).
          db.comandaItem.updateMany({
            where: { id: i.id, paidQty: existing.get(i.id)!.paidQty },
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
  const { paymentMethod, customerName, parts } = parsed.data
  const tip = parsed.data.tip ?? 0
  let finished = true
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
    if (comanda.items.length > 50) return { ok: false, message: "La comanda tiene demasiados productos." }
    // Lo que se cobra ahora: lo elegido (cada uno paga lo suyo) o todo lo que falta por pagar.
    const left = (i: (typeof comanda.items)[number]) => Math.max(0, i.quantity - i.paidQty)
    const wanted = parts ? new Map(parts.map((p) => [p.id, p.quantity])) : null
    if (wanted && [...wanted].some(([itemId, qty]) => { const it = comanda.items.find((i) => i.id === itemId); return !it || qty > left(it) })) {
      return { ok: false, message: "Alguien ya cobró parte de esto. Recarga la página." }
    }
    const charged = comanda.items
      .map((i) => ({ item: i, quantity: wanted ? (wanted.get(i.id) ?? 0) : left(i) }))
      .filter((c) => c.quantity > 0)
    if (!charged.length) return { ok: false, message: wanted ? "Elige qué se cobra." : "La comanda está vacía: agrega lo que pidieron." }
    finished = comanda.items.every((i) => left(i) === (charged.find((c) => c.item.id === i.id)?.quantity ?? 0))
    const lines = await buildLines(
      ctx,
      charged.map(({ item: i, quantity }) => ({
        productId: i.productId ?? undefined,
        description: i.note ? `${i.description} (${i.note})`.slice(0, 120) : i.description,
        quantity,
        unitPrice: i.unitPrice,
      })),
    )
    if (!lines) return { ok: false, message: "Uno de los productos ya no existe. Quítalo de la comanda y vuelve a cobrar." }
    const below = customItemsBlocked(ctx, lines) ?? priceBelowList(ctx, lines)
    if (below) return { ok: false, message: below }
    const subtotal = lines.reduce((sum, l) => sum + l.subtotal, 0)
    if (subtotal <= 0) return { ok: false, message: "El total a cobrar debe ser mayor a 0." }
    if (subtotal > MAX_TOTAL) return { ok: false, message: "El total de la comanda es demasiado alto." }
    if (tip > subtotal) return { ok: false, message: "La propina no puede ser mayor que la cuenta. Revisa el monto." }
    const label = finished && !comanda.items.some((i) => i.paidQty > 0) ? comanda.label : `${comanda.label} (parte)`
    // Promociones automáticas sobre lo que se cobra ahora; el descuento manual va sobre lo que queda.
    const promo = await promotionsFor(ctx, lines, "store")
    const disc = await checkDiscount(ctx, parsed.data, subtotal - promo.discount, label.slice(0, 40))
    if (!disc.ok) return { ok: false, message: disc.message }

    await db.$transaction(async (tx) => {
      // Cada plato se marca pagado solo si nadie lo cobró ni lo cambió entretanto: así nada se cobra dos veces.
      for (const { item, quantity } of charged) {
        const paid = await tx.comandaItem.updateMany({
          where: { id: item.id, comandaId: id, paidQty: item.paidQty, quantity: item.quantity },
          data: { paidQty: item.paidQty + quantity },
        })
        if (paid.count !== 1) throw new Error("ALREADY_CLOSED")
      }
      // Si con esto se pagó todo, se cierra (y solo si seguía abierta).
      const closed = await tx.comanda.updateMany({
        where: { id, status: "OPEN" },
        data: finished ? { status: "PAID", closedAt: new Date() } : { updatedAt: new Date() },
      })
      if (closed.count !== 1) throw new Error("ALREADY_CLOSED")
      const customerId = await resolveCustomer(tx, ctx.businessId, customerName)
      const sale = await tx.sale.create({
        data: {
          businessId: ctx.businessId,
          total: subtotal - promo.discount - disc.discount,
          discount: disc.discount,
          promoDiscount: promo.discount,
          tip,
          paymentMethod,
          note: label.slice(0, 200),
          customerId,
          createdById: ctx.user.id,
          items: { create: lines.map(lineData) },
        },
      })
      await applyStock(tx, ctx, sale.id, lines, `Venta (${label})`.slice(0, 120))
      if (finished) await tx.comanda.update({ where: { id }, data: { saleId: sale.id } })
      await linkPromotions(tx, sale.id, promo.applied)
      await disc.link(tx, sale.id)
    })
  } catch (error) {
    if (isDiscountUsed(error)) return { ok: false, message: DISCOUNT_USED_MESSAGE }
    if (error instanceof Error && error.message === "ALREADY_CLOSED") return { ok: false, message: "Alguien ya cobró esta comanda o la cambió. Recarga la página." }
    return toActionError(error)
  }
  revalidate()
  if (!finished) return { ok: true, message: "Parte cobrada" }
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
/** `device`: el aparato de la cocina (para no mandarle a él mismo el aviso de "listo"). */
export async function markKitchenReady(target: { itemId?: string; comandaId?: string }, undo = false, device?: string): Promise<ActionResult> {
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
      select: { id: true, sentQty: true, readyQty: true, description: true, comanda: { select: { id: true, label: true, createdById: true } } },
    })
    if (!items.length) return { ok: false, message: "Esta comanda ya se cobró o se anuló." }
    // Solo se marca listo lo que se envió a la cocina.
    await db.$transaction(items.map((i) => db.comandaItem.update({ where: { id: i.id }, data: { readyQty: undo ? 0 : i.sentQty } })))
    // Aviso al celular de quien abrió la comanda (el garzón). Si la cocina usa la misma cuenta, igual le llega
    // en sus otros aparatos, menos en la pantalla de la cocina.
    const newlyReady = undo ? [] : items.filter((i) => i.sentQty > i.readyQty)
    const comanda = newlyReady[0]?.comanda
    if (comanda?.createdById) {
      const units = newlyReady.reduce((n, i) => n + (i.sentQty - i.readyQty), 0)
      const waiter = comanda.createdById
      const businessId = ctx.businessId
      after(async () => {
        // Solo si sigue siendo parte del negocio (a alguien que ya no trabaja ahí no le llega nada).
        const member = await db.businessMember.findFirst({ where: { businessId, userId: waiter }, select: { id: true } })
        if (!member) return
        await sendPush([waiter], {
          title: `🍽️ ${comanda.label}: listo para servir`,
          body: newlyReady.length === 1 ? `${units} × ${newlyReady[0].description}` : `${units} platos listos: ${newlyReady.map((i) => i.description).slice(0, 3).join(", ")}`,
          url: "/dashboard/comandas",
          tag: `listo-${comanda.id}`,
        }, typeof device === "string" ? device.slice(0, 1000) : undefined)
      })
    }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: undo ? "Vuelve a la cocina" : "Listo" }
}
