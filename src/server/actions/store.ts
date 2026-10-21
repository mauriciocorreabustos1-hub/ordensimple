"use server"

import { randomUUID } from "node:crypto"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { isFoodBusiness } from "@/lib/business-kind"
import { canUseFeature, effectivePlan } from "@/lib/plans"
import { RESERVED_SLUGS } from "@/lib/store"
import { idSchema, paymentMethod as paymentMethodSchema, storeSettingsSchema, webOrderSchema, type StoreSettingsInput, type WebOrderInput } from "@/lib/validations"
import { allowAttempt } from "@/server/rate-limit"
import { applyStock, buildLines, lineData, MAX_TOTAL, type Tx } from "@/server/sale-core"
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
    const old = current && current !== slug ? [...new Set([...ctx.business.storeOldSlugs, current])].filter((s) => s !== slug).slice(-10) : undefined
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
export async function createWebOrder(input: WebOrderInput): Promise<ActionResult<{ code: string; whatsapp: string; total: number; items: { name: string; quantity: number; unitPrice: number }[] }>> {
  const parsed = webOrderSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { slug, customerName, customerPhone, delivery, note, items, website } = parsed.data
  // Los robots llenan el campo oculto: no se guarda nada.
  if (website) return { ok: false, message: "No se pudo enviar el pedido." }
  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip"
    if (!(await allowAttempt(`pedido-web:${ip}`, 8, 60 * 60_000)) || !(await allowAttempt(`pedido-web-tienda:${slug}`, 120, 60 * 60_000))) {
      return { ok: false, message: "Se enviaron muchos pedidos seguidos. Espera un rato o escríbele directo al negocio." }
    }
    const business = await db.business.findUnique({
      where: { storeSlug: slug },
      select: { id: true, storeEnabled: true, storeWhatsapp: true, plan: true, planExpiresAt: true },
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
    const total = orderItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    if (total > MAX_TOTAL) return { ok: false, message: "El pedido es demasiado grande." }
    const order = await db.webOrder.create({
      data: { businessId: business.id, customerName, customerPhone: customerPhone ?? null, delivery, note: note ?? null, items: orderItems, total },
      select: { id: true },
    })
    return {
      ok: true,
      message: "Pedido listo",
      data: { code: order.id.slice(-5).toUpperCase(), whatsapp: business.storeWhatsapp, total, items: orderItems.map(({ name, quantity, unitPrice }) => ({ name, quantity, unitPrice })) },
    }
  } catch (error) {
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

const lastDigits = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-8)

/** Cliente del pedido web: el que ya tienes con ese nombre y teléfono, o uno nuevo (marcado "web" si el nombre ya existe). */
async function webCustomer(tx: Tx, businessId: string, name: string, phone: string | null) {
  const sameName = await tx.customer.findMany({
    where: { businessId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, phone: true },
    take: 20,
  })
  const digits = lastDigits(phone)
  const match = digits.length === 8 ? sameName.find((c) => lastDigits(c.phone) === digits) : undefined
  if (match) return match.id
  const created = await tx.customer.create({
    data: { businessId, name: (sameName.length ? `${name} (web)` : name).slice(0, 80), phone, notes: "Llegó por la tienda online" },
    select: { id: true },
  })
  return created.id
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
          paymentMethod: pm.data,
          note: `Pedido web${order.delivery ? " (despacho)" : ""}`,
          customerId,
          createdById: ctx.user.id,
          items: { create: lines.map(lineData) },
        },
      })
      await applyStock(tx, ctx, sale.id, lines, "Pedido web")
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
    await claim(db, id, ctx.user.id, { status: "CANCELLED" })
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_HANDLED") return { ok: false, message: HANDLED }
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Pedido descartado" }
}
