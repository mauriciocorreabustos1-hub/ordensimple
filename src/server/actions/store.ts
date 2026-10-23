"use server"

import { randomUUID } from "node:crypto"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { after } from "next/server"
import { db } from "@/lib/db"
import { formatMoney } from "@/lib/currency"
import { businessManagers, sendPush } from "@/server/push"
import { isFoodBusiness } from "@/lib/business-kind"
import { canUseFeature, effectivePlan } from "@/lib/plans"
import { RESERVED_SLUGS } from "@/lib/store"
import { idSchema, paymentMethod as paymentMethodSchema, storeSettingsSchema, webOrderSchema, type StoreSettingsInput, type WebOrderInput } from "@/lib/validations"
import { allowAttempt } from "@/server/rate-limit"
import { applyStock, buildLines, lineData, linkPromotions, MAX_TOTAL, promotionsFor } from "@/server/sale-core"
import { couponAmount, findCoupon } from "@/server/coupons"
import { webCustomer } from "@/server/web-customer"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

const PRO_ONLY = "La tienda online es parte del plan Pro."

/** El dueño o un administrador activa la tienda y elige su dirección y su WhatsApp. */
export async function updateStoreSettings(input: StoreSettingsInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = storeSettingsSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { enabled, slug, whatsapp, message } = parsed.data
  try {
    assertCan(ctx, "settings:manage")
    if (!canUseFeature(ctx.business.plan, "store")) return { ok: false, message: PRO_ONLY }
    if (RESERVED_SLUGS.has(slug)) return { ok: false, message: "Esa dirección no se puede usar. Prueba con el nombre de tu negocio." }
    // Tampoco se puede tomar la dirección que otro negocio usó antes: sus enlaces viejos siguen llevando a él.
    const taken = await db.business.findFirst({
      where: { id: { not: ctx.businessId }, OR: [{ storeSlug: slug }, { storeOldSlugs: { has: slug } }] },
      select: { id: true },
    })
    if (taken) return { ok: false, message: "Esa dirección ya la usa otro negocio. Prueba agregando tu comuna (ej.: almacen-don-pedro-maipu)." }
    const current = ctx.business.storeSlug
    // Para que nadie acapare nombres cambiando la dirección una y otra vez: pocos cambios al mes. Las anteriores quedan reservadas para siempre (sus enlaces viejos no pueden llevar a otro negocio).
    if (current && current !== slug && !(await allowAttempt(`tienda-direccion:${ctx.businessId}`, 3, 30 * 86_400_000))) {
      return { ok: false, message: "Ya cambiaste la dirección de tu tienda varias veces este mes. Escríbenos si necesitas otra." }
    }
    const old = current && current !== slug ? [...ctx.business.storeOldSlugs.filter((s) => s !== current && s !== slug), current] : undefined
    await db.business.update({
      where: { id: ctx.businessId },
      data: { storeEnabled: enabled, storeSlug: slug, storeWhatsapp: whatsapp, storeMessage: message ?? null, ...(old ? { storeOldSlugs: old } : {}) },
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard/configuracion")
  revalidatePath(`/tienda/${slug}`)
  return { ok: true, message: enabled ? "Tienda publicada" : "Tienda guardada (no está visible)" }
}

/**
 * Pedido desde la tienda pública (sin cuenta). Los precios se toman del sistema, nunca del navegador.
 * Devuelve el texto para mandarlo por WhatsApp al negocio.
 */
export type WebOrderResult = {
  code: string
  whatsapp: string
  subtotal: number
  promos: { name: string; amount: number }[]
  coupon: { code: string; amount: number } | null
  total: number
  items: { name: string; quantity: number; unitPrice: number }[]
}

/** Lo que cambió entre lo que veía el cliente y lo que vale ahora (promociones que terminaron o empezaron). */
export type WebOrderQuote = {
  changed: true
  subtotal: number
  promos: { name: string; amount: number }[]
  coupon: { code: string; amount: number } | null
  total: number
}

export async function createWebOrder(input: WebOrderInput): Promise<ActionResult<WebOrderResult | WebOrderQuote>> {
  const parsed = webOrderSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { slug, customerName, customerPhone, delivery, note, items, website, couponCode, expectedTotal } = parsed.data
  // Los robots llenan el campo oculto: no se guarda nada.
  if (website) return { ok: false, message: "No se pudo enviar el pedido." }
  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip"
    if (!(await allowAttempt(`pedido-web:${ip}`, 8, 60 * 60_000)) || !(await allowAttempt(`pedido-web-tienda:${slug}`, 120, 60 * 60_000))) {
      return { ok: false, message: "Se enviaron muchos pedidos seguidos. Espera un rato o escríbele directo al negocio." }
    }
    const business = await db.business.findUnique({
      where: { storeSlug: slug },
      select: { id: true, storeEnabled: true, storeWhatsapp: true, plan: true, planExpiresAt: true, currency: true, timezone: true },
    })
    if (!business || !business.storeEnabled || !business.storeWhatsapp || !canUseFeature(effectivePlan(business), "store")) {
      return { ok: false, message: "Esta tienda no está recibiendo pedidos." }
    }
    const ids = [...new Set(items.map((i) => i.productId))]
    if (ids.length !== items.length) return { ok: false, message: "Hay productos repetidos en el pedido." }
    const products = await db.product.findMany({
      where: { businessId: business.id, id: { in: ids }, active: true, price: { gt: 0 } },
      select: { id: true, name: true, price: true, stock: true, trackStock: true },
    })
    const byId = new Map(products.map((p) => [p.id, p]))
    const lines = items.map((i) => ({ product: byId.get(i.productId), quantity: i.quantity }))
    if (lines.some((l) => !l.product)) return { ok: false, message: "Un producto ya no está disponible. Recarga la página." }
    const short = lines.find((l) => l.product!.trackStock && l.product!.stock < l.quantity)
    if (short) {
      return { ok: false, message: `De ${short.product!.name} quedan ${Math.max(0, short.product!.stock)}. Ajusta la cantidad.` }
    }
    const orderItems = lines.map((l) => ({ productId: l.product!.id, name: l.product!.name, quantity: l.quantity, unitPrice: l.product!.price }))
    const subtotal = orderItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    if (subtotal > MAX_TOTAL) return { ok: false, message: "El pedido es demasiado grande." }
    // Promociones de la tienda y cupón: siempre se calculan aquí, nunca se confía en lo que manda el navegador.
    const plan = effectivePlan(business)
    const promo = await promotionsFor({ businessId: business.id, timezone: business.timezone, business: { plan } }, orderItems, "online")
    let coupon: { id: string; code: string; amount: number; maxUses: number | null } | null = null
    if (couponCode && canUseFeature(plan, "promos")) {
      const found = await findCoupon(business.id, couponCode)
      if ("error" in found) return { ok: false, message: found.error }
      const base = subtotal - promo.discount
      if (base < found.coupon.minTotal) return { ok: false, message: `El cupón ${found.coupon.code} es para compras desde ${formatMoney(found.coupon.minTotal, business.currency)}.` }
      coupon = { id: found.coupon.id, code: found.coupon.code, amount: couponAmount(found.coupon, base), maxUses: found.coupon.maxUses }
    }
    const total = subtotal - promo.discount - (coupon?.amount ?? 0)
    // Si una promoción terminó (o empezó) mientras el cliente miraba, no se crea el pedido: se le muestra
    // el total real y él decide si lo envía igual.
    if (expectedTotal !== undefined && expectedTotal !== total) {
      return {
        ok: true,
        data: { changed: true, subtotal, promos: promo.applied.map((a) => ({ name: a.name, amount: a.amount })), coupon: coupon ? { code: coupon.code, amount: coupon.amount } : null, total },
      }
    }
    const order = await db.$transaction(async (tx) => {
      // El cupón se cuenta como usado solo si quedan usos (si dos lo usan a la vez, no se pasa del límite).
      if (coupon) {
        const used = await tx.storeCoupon.updateMany({
          where: { id: coupon.id, ...(coupon.maxUses !== null ? { uses: { lt: coupon.maxUses } } : {}) },
          data: { uses: { increment: 1 } },
        })
        if (used.count !== 1) throw new Error("COUPON_USED_UP")
      }
      return tx.webOrder.create({
        data: {
          businessId: business.id,
          customerName,
          customerPhone: customerPhone ?? null,
          delivery,
          note: note ?? null,
          items: orderItems,
          total,
          promoDiscount: promo.discount,
          promos: promo.applied,
          couponCode: coupon?.code ?? null,
          couponDiscount: coupon?.amount ?? 0,
        },
        select: { id: true },
      })
    })
    const count = orderItems.reduce((s, i) => s + i.quantity, 0)
    after(async () =>
      sendPush(await businessManagers(business.id), {
        title: "🛒 Nuevo pedido web",
        body: `${customerName}: ${count} ${count === 1 ? "producto" : "productos"} · ${formatMoney(total, business.currency)}${delivery ? " · despacho" : ""}`,
        url: "/dashboard/pedidos",
        tag: `pedido-${order.id}`,
      }),
    )
    return {
      ok: true,
      message: "Pedido listo",
      data: {
        code: order.id.slice(-5).toUpperCase(),
        whatsapp: business.storeWhatsapp,
        subtotal,
        promos: promo.applied.map((a) => ({ name: a.name, amount: a.amount })),
        coupon: coupon ? { code: coupon.code, amount: coupon.amount } : null,
        total,
        items: orderItems.map(({ name, quantity, unitPrice }) => ({ name, quantity, unitPrice })),
      },
    }
  } catch (error) {
    if (error instanceof Error && error.message === "COUPON_USED_UP") return { ok: false, message: "Ese cupón se acaba de agotar." }
    return toActionError(error)
  }
}

type OrderItem = { productId: string; name: string; quantity: number; unitPrice: number }

async function loadOrder(businessId: string, id: string) {
  const order = await db.webOrder.findFirst({ where: { id, businessId, status: "NEW" } })
  return order ? { ...order, items: order.items as OrderItem[] } : null
}

/** Marca el pedido como atendido solo si sigue nuevo: si dos personas lo aceptan a la vez, se registra una vez. */
async function claim(tx: Pick<typeof db, "webOrder">, id: string, userId: string, data: { saleId?: string; comandaId?: string; status: "DONE" | "CANCELLED" }) {
  const r = await tx.webOrder.updateMany({ where: { id, status: "NEW" }, data: { ...data, handledById: userId, handledAt: new Date() } })
  if (r.count !== 1) throw new Error("ORDER_HANDLED")
}

const HANDLED = "Este pedido ya lo atendió otra persona. Recarga la página."

/** Convierte el pedido en una venta (descuenta stock y suma a la caja). */
export async function acceptWebOrderAsSale(id: string, paymentMethod: z.input<typeof paymentMethodSchema>): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const pm = paymentMethodSchema.safeParse(paymentMethod)
  if (!idSchema.safeParse(id).success || !pm.success) return { ok: false, message: "Pedido no encontrado." }
  try {
    assertCan(ctx, "sales:create")
    if (!canUseFeature(ctx.business.plan, "store")) return { ok: false, message: PRO_ONLY }
    // El nombre lo escribió alguien sin cuenta: no se fía a su nombre (podría coincidir con otro cliente).
    if (pm.data === "FIADO") return { ok: false, message: "Un pedido web no se puede fiar. Si es un cliente tuyo, regístralo como venta fiada eligiéndolo." }
    const order = await loadOrder(ctx.businessId, id)
    if (!order) return { ok: false, message: HANDLED }
    const lines = await buildLines(
      ctx,
      order.items.map((i) => ({ productId: i.productId, description: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
    )
    if (!lines) return { ok: false, message: "Un producto del pedido ya no existe. Regístralo como venta a mano." }
    await db.$transaction(async (tx) => {
      // Solo se junta con un cliente que ya tienes si coincide el teléfono; si no, queda como cliente nuevo.
      // Nunca se cambian los datos de un cliente existente con lo que escribió alguien sin cuenta.
      const customerId = await webCustomer(tx, ctx.businessId, order.customerName, order.customerPhone)
      const sale = await tx.sale.create({
        data: {
          businessId: ctx.businessId,
          total: order.total,
          promoDiscount: order.promoDiscount + order.couponDiscount,
          paymentMethod: pm.data,
          note: `Pedido web${order.delivery ? " (despacho)" : ""}`,
          customerId,
          createdById: ctx.user.id,
          items: { create: lines.map(lineData) },
        },
      })
      await applyStock(tx, ctx, sale.id, lines, "Pedido web")
      // Qué promociones y cupón tuvo el pedido, para los reportes.
      const promos = Array.isArray(order.promos) ? (order.promos as { promotionId: string; name: string; amount: number }[]) : []
      await linkPromotions(tx, sale.id, [
        ...promos,
        ...(order.couponCode && order.couponDiscount ? [{ promotionId: "", name: `Cupón ${order.couponCode}`, amount: order.couponDiscount }] : []),
      ])
      await claim(tx, id, ctx.user.id, { saleId: sale.id, status: "DONE" })
    })
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_HANDLED") return { ok: false, message: HANDLED }
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Pedido registrado como venta" }
}

/** Restaurantes: abre el pedido como comanda (para mandarlo a la cocina y cobrarlo después). */
export async function acceptWebOrderAsComanda(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Pedido no encontrado." }
  try {
    assertCan(ctx, "sales:create")
    if (!isFoodBusiness(ctx.business.type) || !canUseFeature(ctx.business.plan, "comandas")) {
      return { ok: false, message: "Las comandas son para negocios de comida con plan Pro." }
    }
    const order = await loadOrder(ctx.businessId, id)
    if (!order) return { ok: false, message: HANDLED }
    await db.$transaction(async (tx) => {
      const comanda = await tx.comanda.create({
        data: {
          businessId: ctx.businessId,
          label: `Web: ${order.customerName}`.slice(0, 40),
          createdById: ctx.user.id,
          items: {
            create: order.items.map((i) => ({
              id: randomUUID(),
              productId: i.productId,
              description: i.name,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              note: order.delivery ? "Despacho" : "Para retirar",
            })),
          },
        },
        select: { id: true },
      })
      await claim(tx, id, ctx.user.id, { comandaId: comanda.id, status: "DONE" })
    })
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_HANDLED") return { ok: false, message: HANDLED }
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Pedido abierto como comanda" }
}

export async function cancelWebOrder(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Pedido no encontrado." }
  try {
    assertCan(ctx, "sales:create")
    const order = await loadOrder(ctx.businessId, id)
    if (!order) return { ok: false, message: HANDLED }
    await db.$transaction(async (tx) => {
      await claim(tx, id, ctx.user.id, { status: "CANCELLED" })
      // El pedido no se concretó: el cupón vuelve a quedar disponible (así nadie lo agota con pedidos falsos).
      if (order.couponCode && order.couponDiscount) {
        await tx.storeCoupon.updateMany({ where: { businessId: ctx.businessId, code: order.couponCode, uses: { gt: 0 } }, data: { uses: { decrement: 1 } } })
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_HANDLED") return { ok: false, message: HANDLED }
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Pedido descartado" }
}

/**
 * Elimina pedidos web que no se concretaron: nuevos (de prueba o de alguien que solo estaba mirando) o ya descartados.
 * Los que se vendieron o se pasaron a comanda no se pueden eliminar. Si un pedido nuevo usaba un cupón, el uso se devuelve.
 */
export async function deleteWebOrders(ids: string[]): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!Array.isArray(ids) || !ids.length || ids.length > 200 || !ids.every((id) => idSchema.safeParse(id).success)) {
    return { ok: false, message: "Pedido no encontrado." }
  }
  try {
    // Borrar es más que descartar: solo quien puede eliminar ventas (dueño y administradores).
    assertCan(ctx, "sales:delete")
    const count = await db.$transaction(async (tx) => {
      const orders = await tx.webOrder.findMany({
        where: { id: { in: ids }, businessId: ctx.businessId, status: { in: ["NEW", "CANCELLED"] } },
        select: { id: true, status: true, couponCode: true, couponDiscount: true },
      })
      let deleted = 0
      for (const o of orders) {
        // Se borra solo si sigue igual que al leerlo; el cupón se devuelve solo si de verdad se borró un pedido nuevo
        // (un descartado ya lo había devuelto). Así, dos personas borrando a la vez no lo devuelven dos veces.
        const { count } = await tx.webOrder.deleteMany({ where: { id: o.id, businessId: ctx.businessId, status: o.status } })
        if (!count) continue
        deleted++
        if (o.status === "NEW" && o.couponCode && o.couponDiscount) {
          await tx.storeCoupon.updateMany({ where: { businessId: ctx.businessId, code: o.couponCode, uses: { gt: 0 } }, data: { uses: { decrement: 1 } } })
        }
      }
      return deleted
    })
    if (!count) return { ok: false, message: "Ese pedido ya se atendió o se eliminó. Recarga la página." }
    revalidatePath("/dashboard", "layout")
    return { ok: true, message: count === 1 ? "Pedido eliminado" : `${count} pedidos eliminados` }
  } catch (error) {
    return toActionError(error)
  }
}

/** Revisa un cupón en la tienda pública (para mostrar el descuento antes de enviar; al enviar se vuelve a revisar). */
export async function previewCoupon(slug: string, code: string): Promise<ActionResult<{ code: string; percent: number | null; amount: number | null; minTotal: number }>> {
  if (typeof slug !== "string" || typeof code !== "string" || slug.length > 40 || code.length > 30) return { ok: false, message: "Cupón no válido." }
  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip"
    // Límite para que nadie pruebe códigos al azar hasta adivinar uno.
    if (!(await allowAttempt(`cupon:${ip}`, 20, 60 * 60_000))) return { ok: false, message: "Probaste muchos cupones seguidos. Espera un rato." }
    const business = await db.business.findUnique({ where: { storeSlug: slug.toLowerCase() }, select: { id: true, storeEnabled: true, plan: true, planExpiresAt: true } })
    if (!business?.storeEnabled || !canUseFeature(effectivePlan(business), "promos")) return { ok: false, message: "Esta tienda no tiene cupones." }
    const found = await findCoupon(business.id, code)
    if ("error" in found) return { ok: false, message: found.error }
    const c = found.coupon
    return { ok: true, data: { code: c.code, percent: c.percent, amount: c.amount, minTotal: c.minTotal } }
  } catch (error) {
    return toActionError(error)
  }
}
