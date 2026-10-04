"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants"
import { businessLimit, PLANS } from "@/lib/plans"
import { requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

const branchSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de la sucursal").max(80),
})

/**
 * Crea otra sucursal (otro negocio) de la que la persona es dueña. Copia país, moneda, zona horaria
 * y rubro del negocio actual, y deja la nueva sucursal abierta.
 */
export async function createBranch(input: z.input<typeof branchSchema>): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = branchSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)

  try {
    if (ctx.role !== "OWNER") return { ok: false, message: "Solo el dueño del negocio puede agregar sucursales." }

    // El límite depende del mejor plan entre los negocios de la persona.
    const owned = await db.businessMember.findMany({
      where: { userId: ctx.user.id, role: "OWNER" },
      select: { business: { select: { plan: true } } },
    })
    const limit = Math.max(...owned.map((o) => businessLimit(o.business.plan)), businessLimit(ctx.business.plan))
    if (owned.length >= limit) {
      return {
        ok: false,
        message: `Tu plan permite hasta ${limit} negocio${limit === 1 ? "" : "s"} o sucursales. Con ${PLANS.BUSINESS.name} puedes tener hasta ${PLANS.BUSINESS.maxBusinesses}.`,
      }
    }

    await db.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: parsed.data.name,
          type: ctx.business.type,
          country: ctx.business.country,
          currency: ctx.business.currency,
          timezone: ctx.business.timezone,
          plan: ctx.business.plan,
          planExpiresAt: ctx.business.planExpiresAt,
          onboardingCompleted: true,
          members: { create: { userId: ctx.user.id, role: "OWNER" } },
          settings: { create: {} },
        },
      })
      await tx.expenseCategory.createMany({
        data: DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
          businessId: business.id,
          name: c.name,
          icon: c.icon,
          isDefault: true,
          isVariable: c.isVariable ?? false,
        })),
        skipDuplicates: true,
      })
      await tx.user.update({ where: { id: ctx.user.id }, data: { activeBusinessId: business.id } })
    })

    revalidatePath("/dashboard", "layout")
    return { ok: true, message: `Creaste la sucursal ${parsed.data.name}. Ya estás en ella.` }
  } catch (error) {
    return toActionError(error)
  }
}
