"use server"

import { canUseFeature } from "@/lib/plans"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import type { z } from "zod"
import { cashClosingSchema, closeShiftSchema, openShiftSchema, type CashClosingInput, type CloseShiftInput } from "@/lib/validations"
import { expectedCash, getCashDay, getCashWindow } from "@/server/queries/cash"
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
  if (!canUseFeature(ctx.business.plan, "cashClose")) return { ok: false, message: "El cierre de caja es parte del plan Pro." }

  try {
    assertCan(ctx, "sales:create")
    const d = await getCashDay(ctx.businessId, ctx.timezone, day)
    const cashOut = expensesFromCash ? d.expensesTotal : 0
    const expected = opening + d.cashSales + d.tipsCash + d.cashPayments + d.depositsCash - cashOut - d.withdrawalsCash
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

const SHIFT_LOCKED = "Pro" as const

/** Un turno a la vez por negocio: este candado evita que dos personas abran o cierren al mismo tiempo. */
async function lockShifts(tx: Pick<typeof db, "$executeRaw">, businessId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"turno:" + businessId}))`
}

/** Abre un turno con el sencillo que hay en la caja. */
export async function openShift(input: z.input<typeof openShiftSchema>): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = openShiftSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  if (!canUseFeature(ctx.business.plan, "cashClose")) return { ok: false, message: `Los turnos de caja son parte del plan ${SHIFT_LOCKED}.` }
  try {
    assertCan(ctx, "sales:create")
    const created = await db.$transaction(async (tx) => {
      await lockShifts(tx, ctx.businessId)
      const open = await tx.cashShift.findFirst({ where: { businessId: ctx.businessId, closedAt: null }, select: { id: true } })
      if (open) return false
      await tx.cashShift.create({ data: { businessId: ctx.businessId, openedById: ctx.user.id, opening: parsed.data.opening } })
      return true
    })
    if (!created) return { ok: false, message: "Ya hay un turno abierto. Ciérralo antes de abrir otro." }
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard/caja")
  return { ok: true, message: "Turno abierto" }
}

/** Cierra el turno: los montos se calculan en el servidor; del formulario solo se toma lo contado. */
export async function closeShift(input: CloseShiftInput): Promise<ActionResult<{ difference: number }>> {
  const ctx = await requireBusiness()
  const parsed = closeShiftSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  if (!canUseFeature(ctx.business.plan, "cashClose")) return { ok: false, message: `Los turnos de caja son parte del plan ${SHIFT_LOCKED}.` }
  const { shiftId, counted, expensesFromCash, note } = parsed.data
  try {
    assertCan(ctx, "sales:create")
    const result = await db.$transaction(async (tx) => {
      await lockShifts(tx, ctx.businessId)
      const shift = await tx.cashShift.findFirst({ where: { id: shiftId, businessId: ctx.businessId, closedAt: null } })
      if (!shift) return null
      const closedAt = new Date()
      // Con la misma conexión de la transacción, para que nadie cierre el turno a la vez.
      const w = await getCashWindow(ctx.businessId, shift.openedAt, closedAt, tx)
      const { cashOut, expected } = expectedCash(shift.opening, w, expensesFromCash)
      const difference = counted - expected
      await tx.cashShift.update({
        where: { id: shift.id },
        data: {
          closedAt,
          closedById: ctx.user.id,
          salesTotal: w.salesTotal,
          salesCount: w.salesCount,
          cashSales: w.cashSales,
          cashIn: w.cashPayments + w.depositsCash - w.withdrawalsCash,
          cashOut,
          expected,
          counted,
          difference,
          note: note ?? null,
        },
      })
      return { difference }
    }, { timeout: 15_000 })
    if (!result) return { ok: false, message: "Ese turno ya se cerró. Recarga la página." }
    revalidatePath("/dashboard/caja")
    return { ok: true, message: "Turno cerrado", data: result }
  } catch (error) {
    return toActionError(error)
  }
}
