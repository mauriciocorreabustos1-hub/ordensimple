"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { canUseFeature } from "@/lib/plans"
import { units } from "@/lib/loyalty"
import { idSchema, money, optionalText } from "@/lib/validations"
import { assertCan, requireBusiness, type BusinessContext } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

const PRO_ONLY = "La tarjeta de fidelidad es parte del plan Pro."
const NOT_FOUND = "Tarjeta no encontrada."

function revalidate() {
  revalidatePath("/dashboard/fidelidad")
}

function allowed(ctx: BusinessContext) {
  return canUseFeature(ctx.business.plan, "loyalty")
}

const settingsSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["STAMPS", "POINTS"]),
  goal: z.number().int().min(1, "Mínimo 1").max(100_000, "Demasiado alto"),
  reward: z.string().trim().min(2, "Escribe el premio").max(80, "Máximo 80 caracteres"),
  minPurchase: money,
  pointValue: z.number().int().min(1, "Mínimo $1").max(10_000_000),
})
export type LoyaltySettingsInput = z.input<typeof settingsSchema>

/** Cómo funciona la tarjeta del negocio. Cambiar entre sellos y puntos solo se puede si nadie tiene saldo. */
export async function saveLoyaltySettings(input: LoyaltySettingsInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  try {
    assertCan(ctx, "settings:manage")
    if (!allowed(ctx)) return { ok: false, message: PRO_ONLY }
    const d = parsed.data
    const current = await db.businessSettings.findUnique({ where: { businessId: ctx.businessId }, select: { loyaltyMode: true } })
    if (current && current.loyaltyMode !== d.mode) {
      const withBalance = await db.loyaltyCard.count({ where: { businessId: ctx.businessId, balance: { gt: 0 } } })
      if (withBalance) {
        return {
          ok: false,
          message: `${withBalance === 1 ? "Un cliente tiene" : `${withBalance} clientes tienen`} ${current.loyaltyMode === "STAMPS" ? "sellos" : "puntos"} en su tarjeta. Para cambiar entre sellos y puntos, primero canjea o deja en cero esas tarjetas.`,
        }
      }
    }
    const data = {
      loyaltyEnabled: d.enabled,
      loyaltyMode: d.mode,
      loyaltyGoal: d.goal,
      loyaltyReward: d.reward,
      loyaltyMinPurchase: d.minPurchase,
      loyaltyPointValue: d.pointValue,
    }
    await db.businessSettings.upsert({ where: { businessId: ctx.businessId }, update: data, create: { businessId: ctx.businessId, ...data } })
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: input.enabled ? "Tarjeta de fidelidad guardada" : "Tarjeta de fidelidad desactivada" }
}

const issueSchema = z.union([
  z.object({ customerId: idSchema }),
  z.object({ name: z.string().trim().min(2, "Escribe el nombre del cliente").max(80), phone: optionalText(30) }),
])
export type IssueCardInput = z.input<typeof issueSchema>

/** Entrega una tarjeta a un cliente guardado o a uno nuevo. Si ya tenía, devuelve la misma. */
export async function issueLoyaltyCard(input: IssueCardInput): Promise<ActionResult<{ id: string; token: string; existed: boolean }>> {
  const ctx = await requireBusiness()
  const parsed = issueSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  try {
    assertCan(ctx, "sales:create")
    if (!allowed(ctx)) return { ok: false, message: PRO_ONLY }
    const d = parsed.data
    const customerId =
      "customerId" in d
        ? (await db.customer.findFirst({ where: { id: d.customerId, businessId: ctx.businessId }, select: { id: true } }))?.id
        : (await db.customer.create({ data: { businessId: ctx.businessId, name: d.name, phone: d.phone ?? null }, select: { id: true } })).id
    if (!customerId) return { ok: false, message: "Ese cliente ya no existe. Recarga la página." }
    const existing = await db.loyaltyCard.findUnique({ where: { customerId }, select: { id: true, token: true } })
    if (existing) return { ok: true, message: "Este cliente ya tenía tarjeta", data: { ...existing, existed: true } }
    const card = await db.loyaltyCard.create({
      data: { businessId: ctx.businessId, customerId, token: randomBytes(18).toString("base64url") },
      select: { id: true, token: true },
    })
    revalidate()
    return { ok: true, message: "Tarjeta lista: envíasela por WhatsApp", data: { ...card, existed: false } }
  } catch (error) {
    return toActionError(error)
  }
}

async function loadCard(ctx: BusinessContext, id: string) {
  return db.loyaltyCard.findFirst({ where: { id, businessId: ctx.businessId }, select: { id: true, balance: true } })
}

/** Sumar (o restar, para corregir) sellos o puntos a mano. */
export async function adjustLoyalty(id: string, amount: number, note?: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000) return { ok: false, message: NOT_FOUND }
  try {
    assertCan(ctx, "sales:create")
    if (!allowed(ctx)) return { ok: false, message: PRO_ONLY }
    const card = await loadCard(ctx, id)
    if (!card) return { ok: false, message: NOT_FOUND }
    const settings = await db.businessSettings.findUnique({ where: { businessId: ctx.businessId }, select: { loyaltyMode: true } })
    const mode = settings?.loyaltyMode ?? "STAMPS"
    if (card.balance + amount < 0) return { ok: false, message: `La tarjeta tiene ${units(mode, card.balance)}: no se puede restar más.` }
    await db.$transaction(async (tx) => {
      // Solo si nadie la cambió entretanto (así dos personas no restan lo mismo dos veces).
      const r = await tx.loyaltyCard.updateMany({ where: { id, balance: card.balance }, data: { balance: card.balance + amount } })
      if (r.count !== 1) throw new Error("CARD_CHANGED")
      await tx.loyaltyMovement.create({ data: { cardId: id, kind: "ADJUST", amount, note: note?.trim().slice(0, 80) || null, createdById: ctx.user.id } })
    })
    revalidate()
    return { ok: true, message: amount > 0 ? `+${units(mode, amount)}` : `−${units(mode, -amount)}` }
  } catch (error) {
    if (error instanceof Error && error.message === "CARD_CHANGED") return { ok: false, message: "La tarjeta cambió recién. Vuelve a intentar." }
    return toActionError(error)
  }
}

/** Canjear el premio: descuenta los sellos o puntos de la meta y suma un premio canjeado. */
export async function redeemLoyalty(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: NOT_FOUND }
  try {
    assertCan(ctx, "sales:create")
    if (!allowed(ctx)) return { ok: false, message: PRO_ONLY }
    const card = await loadCard(ctx, id)
    if (!card) return { ok: false, message: NOT_FOUND }
    const settings = await db.businessSettings.findUnique({ where: { businessId: ctx.businessId }, select: { loyaltyGoal: true, loyaltyMode: true, loyaltyReward: true } })
    const goal = settings?.loyaltyGoal ?? 10
    if (card.balance < goal) return { ok: false, message: `Todavía le faltan ${units(settings?.loyaltyMode ?? "STAMPS", goal - card.balance)} para el premio.` }
    await db.$transaction(async (tx) => {
      const r = await tx.loyaltyCard.updateMany({ where: { id, balance: card.balance }, data: { balance: card.balance - goal, rewards: { increment: 1 } } })
      if (r.count !== 1) throw new Error("CARD_CHANGED")
      await tx.loyaltyMovement.create({ data: { cardId: id, kind: "REDEEM", amount: -goal, note: settings?.loyaltyReward ?? null, createdById: ctx.user.id } })
    })
    revalidate()
    return { ok: true, message: `Premio canjeado: ${settings?.loyaltyReward ?? "premio"}` }
  } catch (error) {
    if (error instanceof Error && error.message === "CARD_CHANGED") return { ok: false, message: "La tarjeta cambió recién. Vuelve a intentar." }
    return toActionError(error)
  }
}

export async function deleteLoyaltyCard(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: NOT_FOUND }
  try {
    assertCan(ctx, "sales:delete")
    const r = await db.loyaltyCard.deleteMany({ where: { id, businessId: ctx.businessId } })
    if (r.count !== 1) return { ok: false, message: NOT_FOUND }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Tarjeta eliminada: su enlace deja de funcionar" }
}

/** Busca la tarjeta escaneada (el QR trae el enlace de la tarjeta). Solo tarjetas de este negocio. */
export async function findLoyaltyCard(scanned: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusiness()
  const token = scanned.trim().match(/(?:\/tarjeta\/)?([\w-]{16,64})\/?$/)?.[1]
  if (!token) return { ok: false, message: "Ese código no es una tarjeta de fidelidad." }
  const card = await db.loyaltyCard.findFirst({ where: { token, businessId: ctx.businessId }, select: { id: true } })
  if (!card) return { ok: false, message: "Esa tarjeta no es de este negocio." }
  return { ok: true, data: card }
}
