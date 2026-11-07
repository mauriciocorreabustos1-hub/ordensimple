"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants"
import { cancelPreapproval } from "@/lib/mercadopago"
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
          // Pro permanente: la sucursal también queda cubierta por el código (y vuelve a Gratis si se anula).
          licenseCodeId: ctx.business.licenseCodeId,
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

const deleteBranchSchema = z.object({
  businessId: z.string().min(1),
  /** Se escribe el nombre para confirmar: evita borrar la sucursal equivocada. */
  confirmName: z.string().trim(),
})

/**
 * Elimina una sucursal para siempre, con todas sus ventas, gastos, productos, clientes y cierres de caja.
 * Solo el dueño, y solo si le queda al menos otra sucursal (para borrar todo está "Eliminar mi cuenta").
 */
export async function deleteBranch(input: z.input<typeof deleteBranchSchema>): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = deleteBranchSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Datos inválidos." }
  const { businessId, confirmName } = parsed.data

  try {
    const owned = await db.businessMember.findMany({
      where: { userId: ctx.user.id, role: "OWNER", business: { onboardingCompleted: true } },
      select: { business: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    })
    const target = owned.find((o) => o.business.id === businessId)?.business
    if (!target) return { ok: false, message: "Solo el dueño puede eliminar una sucursal." }
    if (owned.length < 2) {
      return { ok: false, message: "Es tu única sucursal. Para borrar todo, usa “Eliminar mi cuenta” en Configuración." }
    }
    if (confirmName.toLowerCase() !== target.name.trim().toLowerCase()) {
      return { ok: false, message: "El nombre no coincide. Escríbelo tal como aparece." }
    }

    // Si pagaba una suscripción, se cancela antes para que Mercado Pago no le siga cobrando.
    const subs = await db.subscription.findMany({
      where: { businessId, status: { in: ["authorized", "paused", "pending"] } },
      select: { externalId: true },
    })
    for (const s of subs) {
      try {
        await cancelPreapproval(s.externalId)
      } catch (error) {
        console.error("[branches] no se pudo cancelar la suscripción", s.externalId, error)
        return { ok: false, message: "No pudimos cancelar la suscripción de esta sucursal. Cancélala en Tu plan e intenta de nuevo." }
      }
    }

    const next = owned.find((o) => o.business.id !== businessId)!.business
    await db.$transaction([
      // Quien la tenía abierta entra a otra de sus sucursales.
      db.user.updateMany({ where: { activeBusinessId: businessId }, data: { activeBusinessId: null } }),
      db.user.update({ where: { id: ctx.user.id }, data: { activeBusinessId: next.id } }),
      db.business.delete({ where: { id: businessId } }),
    ])
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Sucursal eliminada" }
}
