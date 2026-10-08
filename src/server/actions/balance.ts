"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { formatNumber } from "@/lib/currency"
import { dateKeyToUtc } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import {
  balanceSettingsSchema,
  idSchema,
  loanSchema,
  withdrawalSchema,
  type BalanceSettingsInput,
  type LoanInput,
  type WithdrawalInput,
} from "@/lib/validations"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

const PRO_MESSAGE = "El balance y los retiros del dueño son parte del plan Pro."

async function ctxForBalance() {
  const ctx = await requireBusiness()
  assertCan(ctx, "finances:view")
  return ctx
}

function done(message: string): ActionResult {
  revalidatePath("/dashboard", "layout")
  return { ok: true, message }
}

/** Registra un retiro del dueño: plata (de la caja o del banco) o productos (salen del stock, al costo). */
export async function createWithdrawal(input: WithdrawalInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = withdrawalSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const v = parsed.data
  try {
    assertCan(ctx, "finances:view")
    if (!canUseFeature(ctx.business.plan, "balance")) return { ok: false, message: PRO_MESSAGE }
    // A mediodía del día elegido, para que no se corra de día por la zona horaria.
    const date = new Date(dateKeyToUtc(v.date, ctx.timezone).getTime() + 12 * 3_600_000)

    if (v.kind !== "GOODS") {
      await db.ownerWithdrawal.create({
        data: { businessId: ctx.businessId, amount: v.amount!, date, source: v.source, kind: v.kind, note: v.note, createdById: ctx.user.id },
      })
      return done(v.kind === "DEPOSIT" ? "Anotado: pusiste plata en el negocio" : "Retiro anotado")
    }

    const product = await db.product.findFirst({ where: { id: v.productId!, businessId: ctx.businessId } })
    if (!product) return { ok: false, message: "Ese producto ya no existe. Recarga la página." }
    const qty = v.quantity!
    if (product.trackStock && product.stock < qty) {
      return { ok: false, message: `Solo tienes ${formatNumber(Math.max(0, product.stock))} unidades registradas de ${product.name}.` }
    }
    await db.$transaction([
      db.ownerWithdrawal.create({
        data: {
          businessId: ctx.businessId,
          amount: product.cost * qty,
          date,
          source: "STOCK",
          kind: "GOODS",
          productId: product.id,
          quantity: qty,
          note: v.note ?? product.name,
          createdById: ctx.user.id,
        },
      }),
      ...(product.trackStock
        ? [
            db.product.update({ where: { id: product.id }, data: { stock: { decrement: qty } } }),
            db.inventoryMovement.create({
              data: {
                businessId: ctx.businessId,
                productId: product.id,
                type: "OUT",
                quantity: -qty,
                unitCost: product.cost,
                reason: "Retiro del dueño (consumo propio)",
                createdById: ctx.user.id,
              },
            }),
          ]
        : []),
    ])
    return done(`Retiro anotado: ${qty} × ${product.name}`)
  } catch (error) {
    return toActionError(error)
  }
}

/** Borra un retiro. Si eran productos, devuelve las unidades al stock. */
export async function deleteWithdrawal(id: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Retiro no encontrado." }
  try {
    const ctx = await ctxForBalance()
    const w = await db.ownerWithdrawal.findFirst({ where: { id: parsedId.data, businessId: ctx.businessId } })
    if (!w) return { ok: false, message: "Retiro no encontrado." }
    const product = w.kind === "GOODS" && w.productId ? await db.product.findFirst({ where: { id: w.productId, businessId: ctx.businessId } }) : null
    await db.$transaction([
      db.ownerWithdrawal.delete({ where: { id: w.id } }),
      ...(product?.trackStock && w.quantity
        ? [
            db.product.update({ where: { id: product.id }, data: { stock: { increment: w.quantity } } }),
            db.inventoryMovement.create({
              data: {
                businessId: ctx.businessId,
                productId: product.id,
                type: "IN",
                quantity: w.quantity,
                unitCost: product.cost,
                reason: "Se borró un retiro del dueño",
                createdById: ctx.user.id,
              },
            }),
          ]
        : []),
    ])
  } catch (error) {
    return toActionError(error)
  }
  return done("Retiro borrado")
}

/** Sueldo del dueño (meta mensual) y plata en caja y banco hoy (punto de partida del balance). */
export async function saveBalanceSettings(input: BalanceSettingsInput): Promise<ActionResult> {
  const parsed = balanceSettingsSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  try {
    const ctx = await ctxForBalance()
    if (!canUseFeature(ctx.business.plan, "balance")) return { ok: false, message: PRO_MESSAGE }
    const data = {
      ...(parsed.data.ownerSalary !== undefined ? { ownerSalary: parsed.data.ownerSalary || null } : {}),
      ...(parsed.data.openingCash !== undefined ? { openingCash: parsed.data.openingCash, openingCashAt: new Date() } : {}),
    }
    await db.businessSettings.upsert({ where: { businessId: ctx.businessId }, create: { businessId: ctx.businessId, ...data }, update: data })
  } catch (error) {
    return toActionError(error)
  }
  return done("Guardado")
}

export async function saveLoan(input: LoanInput, id?: string): Promise<ActionResult> {
  const parsed = loanSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  try {
    const ctx = await ctxForBalance()
    if (!canUseFeature(ctx.business.plan, "balance")) return { ok: false, message: PRO_MESSAGE }
    const { receivedTo, ...fields } = parsed.data
    const data = { ...fields, installment: fields.installment || null, dueDay: fields.dueDay ?? null }
    // Un préstamo nuevo que se acaba de recibir: la plata entra a la caja o al banco.
    if (!id && receivedTo && fields.balance > 0) {
      await db.ownerWithdrawal.create({
        data: { businessId: ctx.businessId, amount: fields.balance, date: new Date(), source: receivedTo, kind: "DEPOSIT", note: `Préstamo: ${fields.lender}`, createdById: ctx.user.id },
      })
    }
    if (id) {
      const { count } = await db.loan.updateMany({ where: { id, businessId: ctx.businessId }, data })
      if (!count) return { ok: false, message: "Préstamo no encontrado." }
    } else {
      await db.loan.create({ data: { businessId: ctx.businessId, ...data } })
    }
  } catch (error) {
    return toActionError(error)
  }
  return done(id ? "Préstamo actualizado" : "Préstamo anotado")
}

/** Pagaste una cuota: baja lo que debes (lo que se pagó de interés no se separa; es un cálculo simple). */
export async function payLoanInstallment(id: string): Promise<ActionResult> {
  try {
    const ctx = await ctxForBalance()
    const loan = await db.loan.findFirst({ where: { id, businessId: ctx.businessId } })
    if (!loan?.installment) return { ok: false, message: "Ese préstamo no tiene cuota anotada." }
    await db.loan.update({ where: { id: loan.id }, data: { balance: Math.max(0, loan.balance - loan.installment) } })
  } catch (error) {
    return toActionError(error)
  }
  return done("Cuota descontada de lo que debes")
}

export async function deleteLoan(id: string): Promise<ActionResult> {
  try {
    const ctx = await ctxForBalance()
    const { count } = await db.loan.deleteMany({ where: { id, businessId: ctx.businessId } })
    if (!count) return { ok: false, message: "Préstamo no encontrado." }
  } catch (error) {
    return toActionError(error)
  }
  return done("Préstamo borrado")
}

