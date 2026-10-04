"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { formatNumber } from "@/lib/currency"
import { canUseFeature } from "@/lib/plans"
import { inventoryMovementSchema, type InventoryMovementInput } from "@/lib/validations"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

const DEFAULT_REASON = { IN: "Entrada de mercadería", OUT: "Salida", ADJUSTMENT: "Ajuste por conteo" } as const

export async function createInventoryMovement(input: InventoryMovementInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = inventoryMovementSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { productId, type, quantity, reason } = parsed.data

  if (type !== "ADJUSTMENT" && quantity < 1) return { ok: false, message: "Ingresa al menos 1 unidad." }

  try {
    assertCan(ctx, "inventory:manage")
    if (!canUseFeature(ctx.business.plan, "inventory")) {
      return { ok: false, message: "El inventario es parte del plan Pro." }
    }

    const product = await db.product.findFirst({ where: { id: productId, businessId: ctx.businessId } })
    if (!product) return { ok: false, message: "Ese producto ya no existe. Recarga la página." }

    let delta: number
    if (type === "IN") delta = quantity
    else if (type === "OUT") {
      if (product.stock < quantity) {
        return {
          ok: false,
          message: `Solo tienes ${formatNumber(Math.max(0, product.stock))} unidades registradas de ${product.name}.`,
        }
      }
      delta = -quantity
    } else delta = quantity - product.stock

    if (delta === 0) return { ok: true, message: "El stock ya coincide con tu conteo" }

    await db.$transaction([
      db.product.update({
        where: { id: product.id },
        // Registrar un movimiento activa el control de stock si estaba apagado.
        data: { stock: { increment: delta }, trackStock: true },
      }),
      db.inventoryMovement.create({
        data: {
          businessId: ctx.businessId,
          productId: product.id,
          type,
          quantity: delta,
          reason: reason ?? DEFAULT_REASON[type],
          createdById: ctx.user.id,
        },
      }),
    ])
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Movimiento registrado" }
}
