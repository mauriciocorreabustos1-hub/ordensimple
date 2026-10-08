"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { cashClosingSchema, type CashClosingInput } from "@/lib/validations"
import { getCashDay } from "@/server/queries/cash"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

/**
 * Guarda el cierre de caja del día. Los montos de ventas, abonos y gastos se recalculan
 * en el servidor; del formulario solo se toman la apertura y lo contado.
 */
export async function saveCashClosing(input: CashClosingInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = cashClosingSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { day, opening, counted, expensesFromCash, note } = parsed.data

  try {
    assertCan(ctx, "sales:create")
    const d = await getCashDay(ctx.businessId, ctx.timezone, day)
    const cashOut = expensesFromCash ? d.expensesTotal : 0
    const expected = opening + d.cashSales + d.cashPayments + d.depositsCash - cashOut - d.withdrawalsCash
    const data = {
      opening,
      cashSales: d.cashSales,
      cashIn: d.cashPayments,
      cashOut,
      expected,
      counted,
      difference: counted - expected,
      note: note ?? null,
    }
    await db.cashClosing.upsert({
      where: { businessId_day: { businessId: ctx.businessId, day } },
      create: { ...data, businessId: ctx.businessId, day, createdById: ctx.user.id },
      update: data,
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard/caja")
  return { ok: true, message: "Cierre de caja guardado" }
}
