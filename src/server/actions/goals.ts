"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { toMonthKey } from "@/lib/dates"
import { goalSchema, type GoalInput } from "@/lib/validations"
import { requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

/** Guarda la meta de ganancia del mes en curso. Cualquier miembro puede verla; solo dueño/admin la cambia. */
export async function saveGoal(input: GoalInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = goalSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  if (ctx.role === "EMPLOYEE") return { ok: false, message: "Solo el dueño o un administrador puede cambiar la meta." }

  try {
    const month = toMonthKey(new Date(), ctx.timezone)
    await db.goal.upsert({
      where: { businessId_month: { businessId: ctx.businessId, month } },
      create: { businessId: ctx.businessId, month, ...parsed.data },
      update: parsed.data,
    })
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard/herramientas/meta")
  return { ok: true, message: "Meta guardada" }
}
