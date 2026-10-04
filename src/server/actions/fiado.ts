"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { formatMoney } from "@/lib/currency"
import { dateKeyToInstant } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { customerPaymentSchema, idSchema, type CustomerPaymentInput } from "@/lib/validations"
import { getCustomerBalance } from "@/server/queries/fiado"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

/** Registra un abono: el cliente paga (todo o parte) de lo que debe. */
export async function createCustomerPayment(input: CustomerPaymentInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = customerPaymentSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { customerId, amount, date, paymentMethod, note } = parsed.data

  try {
    assertCan(ctx, "sales:create")
    if (!canUseFeature(ctx.business.plan, "customers")) return { ok: false, message: "El fiado es parte del plan Pro." }

    const customer = await db.customer.findFirst({ where: { id: customerId, businessId: ctx.businessId } })
    if (!customer) return { ok: false, message: "Cliente no encontrado." }

    const balance = await getCustomerBalance(ctx.businessId, customer.id)
    if (amount > balance) {
      return {
        ok: false,
        message:
          balance > 0
            ? `${customer.name} te debe ${formatMoney(balance, ctx.currency)}. El abono no puede ser mayor.`
            : `${customer.name} no tiene deuda pendiente.`,
      }
    }

    await db.customerPayment.create({
      data: {
        businessId: ctx.businessId,
        customerId: customer.id,
        amount,
        date: dateKeyToInstant(date, ctx.timezone),
        paymentMethod,
        note,
        createdById: ctx.user.id,
      },
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Abono registrado" }
}

export async function deleteCustomerPayment(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Abono no encontrado." }

  try {
    assertCan(ctx, "sales:delete")
    const { count } = await db.customerPayment.deleteMany({ where: { id: parsedId.data, businessId: ctx.businessId } })
    if (count === 0) return { ok: false, message: "Abono no encontrado." }
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Abono eliminado" }
}
