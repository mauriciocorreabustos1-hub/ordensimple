"use server"

import { randomBytes } from "node:crypto"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { formatMoney } from "@/lib/currency"
import { canUseFeature, effectivePlan } from "@/lib/plans"
import { quoteNumber, quoteState, type QuoteItem } from "@/lib/quotes"
import { canApproveDiscounts } from "@/lib/roles"
import { idSchema, paymentMethod as paymentMethodSchema, quoteInfoSchema, quoteSchema, type QuoteInfoInput, type QuoteInput } from "@/lib/validations"
import { businessManagers, sendPush } from "@/server/push"
import { allowAttempt } from "@/server/rate-limit"
import { applyStock, buildLines, customItemsBlocked, FIADO_PRO, fiadoBlocked, lineData, MAX_TOTAL, priceBelowList, quantityError, resolveCustomer } from "@/server/sale-core"
import { assertCan, requireBusiness, type BusinessContext } from "@/server/session"
import { earnLoyalty } from "@/server/loyalty"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

const PRO_ONLY = "Las cotizaciones son parte del plan Pro."
const NOT_FOUND = "Cotización no encontrada."
const DAY_MS = 86_400_000

function revalidate() {
  revalidatePath("/dashboard/cotizaciones")
}

const newToken = () => randomBytes(18).toString("base64url")

/** Revisa la cotización (productos del negocio, precios, descuento y cliente) y calcula sus montos. */
type Prepared = {
  customerId: string | null
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  items: QuoteItem[]
  subtotal: number
  discount: number
  total: number
  note: string | null
  validUntil: Date
}

async function prepare(ctx: BusinessContext, data: z.output<typeof quoteSchema>): Promise<{ error: string } | { data: Prepared }> {
  const lines = await buildLines(ctx, data.items)
  if (!lines) return { error: "Uno de los productos ya no existe. Recarga la página." }
  // Por unidad, enteros; por kilo o metro, hasta gramos o centímetros (lo mismo que al vender).
  const badQuantity = quantityError(lines)
  if (badQuantity) return { error: badQuantity }
  // Mismas reglas que al vender: un empleado no inventa productos ni baja precios, y el descuento lo da el encargado.
  const blocked = customItemsBlocked(ctx, lines) ?? priceBelowList(ctx, lines)
  if (blocked) return { error: blocked.replace("vender", "cotizar").replace("cobrar", "cotizar") }
  const discount = data.discount ?? 0
  if (discount > 0 && !canApproveDiscounts(ctx.role)) return { error: "Solo el dueño o un administrador puede dar descuentos en una cotización." }
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0)
  if (subtotal > MAX_TOTAL) return { error: "El total de la cotización es demasiado alto." }
  const customer = data.customerId
    ? await db.customer.findFirst({ where: { id: data.customerId, businessId: ctx.businessId }, select: { id: true } })
    : null
  if (data.customerId && !customer) return { error: "Ese cliente ya no existe. Recarga la página." }
  const items: QuoteItem[] = lines.map((l) => ({ productId: l.productId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice }))
  return {
    data: {
      customerId: customer?.id ?? null,
      customerName: data.customerName,
      customerPhone: data.customerPhone ?? null,
      customerEmail: data.customerEmail ?? null,
      items,
      subtotal,
      discount,
      total: subtotal - discount,
      note: data.note ?? null,
      validUntil: new Date(Date.now() + data.validDays * DAY_MS),
    },
  }
}

function checkAccess(ctx: BusinessContext) {
  assertCan(ctx, "sales:create")
  return canUseFeature(ctx.business.plan, "quotes")
}

const isNumberTaken = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && String(error.meta?.target ?? "").includes("number")

export async function createQuote(input: QuoteInput): Promise<ActionResult<{ id: string; token: string; number: number }>> {
  const ctx = await requireBusiness()
  const parsed = quoteSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  try {
    if (!checkAccess(ctx)) return { ok: false, message: PRO_ONLY }
    const ready = await prepare(ctx, parsed.data)
    if ("error" in ready) return { ok: false, message: ready.error }
    // Correlativo del negocio; si dos cotizan a la vez y chocan, se toma el siguiente.
    for (let attempt = 0; ; attempt++) {
      try {
        const last = await db.quote.findFirst({ where: { businessId: ctx.businessId }, orderBy: { number: "desc" }, select: { number: true } })
        const quote = await db.quote.create({
          data: { ...ready.data, businessId: ctx.businessId, number: (last?.number ?? 0) + 1, token: newToken(), createdById: ctx.user.id },
          select: { id: true, token: true, number: true },
        })
        revalidate()
        return { ok: true, message: `Cotización n.º ${quoteNumber(quote.number)} creada`, data: quote }
      } catch (error) {
        if (!isNumberTaken(error) || attempt >= 4) throw error
      }
    }
  } catch (error) {
    return toActionError(error)
  }
}

/** Editar cambia lo que se ofreció: la cotización vuelve a quedar pendiente (el cliente responde de nuevo). */
export async function updateQuote(id: string, input: QuoteInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = quoteSchema.safeParse(input)
  if (!idSchema.safeParse(id).success) return { ok: false, message: NOT_FOUND }
  if (!parsed.success) return validationError(parsed.error)
  try {
    if (!checkAccess(ctx)) return { ok: false, message: PRO_ONLY }
    const ready = await prepare(ctx, parsed.data)
    if ("error" in ready) return { ok: false, message: ready.error }
    const r = await db.quote.updateMany({
      where: { id, businessId: ctx.businessId, status: { not: "SOLD" } },
      data: { ...ready.data, status: "PENDING", respondedAt: null },
    })
    if (r.count !== 1) return { ok: false, message: "Esta cotización ya se vendió, así que no se puede editar." }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Cotización actualizada" }
}

export async function deleteQuote(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: NOT_FOUND }
  try {
    assertCan(ctx, "sales:delete")
    // Si ya se vendió, la venta queda igual (solo se borra la cotización).
    const r = await db.quote.deleteMany({ where: { id, businessId: ctx.businessId } })
    if (r.count !== 1) return { ok: false, message: NOT_FOUND }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Cotización eliminada" }
}

/** Marcarla a mano (por ejemplo, si el cliente la aceptó por teléfono). */
export async function setQuoteStatus(id: string, status: "PENDING" | "ACCEPTED" | "REJECTED"): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success || !["PENDING", "ACCEPTED", "REJECTED"].includes(status)) return { ok: false, message: NOT_FOUND }
  try {
    if (!checkAccess(ctx)) return { ok: false, message: PRO_ONLY }
    const r = await db.quote.updateMany({
      where: { id, businessId: ctx.businessId, status: { not: "SOLD" } },
      data: { status, respondedAt: status === "PENDING" ? null : new Date() },
    })
    if (r.count !== 1) return { ok: false, message: "Esta cotización ya se vendió." }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: status === "ACCEPTED" ? "Marcada como aceptada" : status === "REJECTED" ? "Marcada como rechazada" : "Marcada como pendiente" }
}

/** Vende la cotización con sus mismos precios: descuenta el stock y suma a la caja de hoy. */
export async function sellQuote(id: string, paymentMethod: z.input<typeof paymentMethodSchema>): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const pm = paymentMethodSchema.safeParse(paymentMethod)
  if (!idSchema.safeParse(id).success || !pm.success) return { ok: false, message: NOT_FOUND }
  try {
    if (!checkAccess(ctx)) return { ok: false, message: PRO_ONLY }
    if (fiadoBlocked(ctx, pm.data)) return { ok: false, message: FIADO_PRO }
    const quote = await db.quote.findFirst({ where: { id, businessId: ctx.businessId } })
    if (!quote) return { ok: false, message: NOT_FOUND }
    if (quote.status === "SOLD") return { ok: false, message: "Esta cotización ya se vendió." }
    const items = quote.items as QuoteItem[]
    // Si un producto se borró después de cotizar, esa línea se vende como producto escrito a mano.
    const ids = items.map((i) => i.productId).filter((p): p is string => Boolean(p))
    const existing = new Set(
      (await db.product.findMany({ where: { businessId: ctx.businessId, id: { in: ids } }, select: { id: true } })).map((p) => p.id),
    )
    const lines = await buildLines(
      ctx,
      items.map((i) => ({ productId: i.productId && existing.has(i.productId) ? i.productId : undefined, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    )
    if (!lines) return { ok: false, message: "Uno de los productos ya no existe. Recarga la página." }
    const badQuantity = quantityError(lines)
    if (badQuantity) return { ok: false, message: badQuantity }
    const label = `Cotización n.º ${quoteNumber(quote.number)}`
    await db.$transaction(async (tx) => {
      const customerId = quote.customerId ?? (await resolveCustomer(tx, ctx.businessId, quote.customerName))
      const sale = await tx.sale.create({
        data: {
          businessId: ctx.businessId,
          total: quote.total,
          discount: quote.discount,
          paymentMethod: pm.data,
          note: label,
          customerId,
          createdById: ctx.user.id,
          items: { create: lines.map(lineData) },
        },
        select: { id: true },
      })
      await applyStock(tx, ctx, sale.id, lines, label)
      await earnLoyalty(tx, ctx, sale.id, customerId, quote.total)
      // Solo una vez, aunque dos personas la vendan al mismo tiempo.
      const r = await tx.quote.updateMany({ where: { id, status: { not: "SOLD" } }, data: { status: "SOLD", saleId: sale.id, customerId } })
      if (r.count !== 1) throw new Error("QUOTE_SOLD")
    })
  } catch (error) {
    if (error instanceof Error && error.message === "QUOTE_SOLD") return { ok: false, message: "Esta cotización ya se vendió." }
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: pm.data === "FIADO" ? "Venta fiada guardada" : "Venta guardada" }
}

/** Datos del negocio que salen en las cotizaciones. */
export async function updateQuoteInfo(input: QuoteInfoInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = quoteInfoSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  try {
    assertCan(ctx, "settings:manage")
    const d = parsed.data
    const data = {
      taxId: d.taxId ?? null,
      address: d.address ?? null,
      contactPhone: d.contactPhone ?? null,
      contactEmail: d.contactEmail ?? null,
      quoteTerms: d.quoteTerms ?? null,
      quoteValidDays: d.quoteValidDays,
    }
    await db.businessSettings.upsert({ where: { businessId: ctx.businessId }, update: data, create: { businessId: ctx.businessId, ...data } })
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Datos guardados" }
}

/** El cliente acepta o rechaza desde el enlace (sin cuenta): solo si sigue pendiente y vigente. */
export async function respondToQuote(token: string, accept: boolean): Promise<ActionResult> {
  if (!/^[\w-]{16,64}$/.test(token)) return { ok: false, message: NOT_FOUND }
  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip"
    if (!(await allowAttempt(`cotizacion:${ip}`, 20, 60 * 60_000))) return { ok: false, message: "Demasiados intentos. Espera un rato." }
    const quote = await db.quote.findUnique({
      where: { token },
      select: { id: true, number: true, status: true, validUntil: true, total: true, customerName: true, businessId: true, business: { select: { plan: true, planExpiresAt: true, currency: true } } },
    })
    if (!quote || !canUseFeature(effectivePlan(quote.business), "quotes")) return { ok: false, message: NOT_FOUND }
    if (quoteState(quote.status, quote.validUntil) !== "PENDING") return { ok: false, message: "Esta cotización ya no se puede responder. Escríbele al negocio." }
    const r = await db.quote.updateMany({ where: { id: quote.id, status: "PENDING" }, data: { status: accept ? "ACCEPTED" : "REJECTED", respondedAt: new Date() } })
    if (r.count !== 1) return { ok: false, message: "Esta cotización ya se respondió." }
    after(async () =>
      sendPush(await businessManagers(quote.businessId), {
        title: accept ? `✅ Cotización n.º ${quoteNumber(quote.number)} aceptada` : `❌ Cotización n.º ${quoteNumber(quote.number)} rechazada`,
        body: `${quote.customerName} · ${formatMoney(quote.total, quote.business.currency)}`,
        url: "/dashboard/cotizaciones",
        tag: `cotizacion-${quote.id}`,
      }),
    )
  } catch (error) {
    return toActionError(error)
  }
  return { ok: true, message: accept ? "¡Listo! Avisamos al negocio que aceptaste." : "Listo, avisamos al negocio." }
}
