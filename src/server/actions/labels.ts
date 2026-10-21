"use server"

import { randomInt } from "node:crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { internalEan13 } from "@/lib/barcode"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, type ActionResult } from "@/server/actions/result"

const idsSchema = z.array(z.string().min(1).max(40)).min(1).max(500)

/**
 * Crea un código de barras interno (EAN-13 que empieza con 20) a los productos elegidos que no tienen código.
 * No toca los que ya tienen uno. Devuelve el código de cada producto.
 */
export async function assignInternalCodes(productIds: string[]): Promise<ActionResult<Record<string, string>>> {
  const parsed = idsSchema.safeParse(productIds)
  if (!parsed.success) return { ok: false, message: "Elige al menos un producto." }
  const ctx = await requireBusiness()
  try {
    assertCan(ctx, "products:manage")
    const products = await db.product.findMany({
      where: { businessId: ctx.businessId, id: { in: parsed.data }, OR: [{ sku: null }, { sku: "" }] },
      select: { id: true },
    })
    const result: Record<string, string> = {}
    for (const p of products) {
      // Se prueba hasta encontrar uno libre en el negocio (como código principal o adicional).
      for (let attempt = 0; attempt < 20; attempt++) {
        const code = internalEan13(() => randomInt(10) / 10)
        const taken = await db.product.count({ where: { businessId: ctx.businessId, OR: [{ sku: code }, { barcodes: { some: { code } } }] } })
        if (taken) continue
        const updated = await db.product.updateMany({ where: { id: p.id, businessId: ctx.businessId, OR: [{ sku: null }, { sku: "" }] }, data: { sku: code } })
        if (updated.count) result[p.id] = code
        break
      }
    }
    revalidatePath("/dashboard/productos")
    return { ok: true, data: result }
  } catch (error) {
    return toActionError(error)
  }
}
