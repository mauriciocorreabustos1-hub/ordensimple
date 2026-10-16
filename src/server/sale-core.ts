import "server-only"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { canUseFeature } from "@/lib/plans"
import type { SaleInput } from "@/lib/validations"
import type { BusinessContext } from "@/server/session"

// Piezas comunes para guardar una venta: las usan las ventas y el cobro de comandas.

export type Tx = Prisma.TransactionClient

export const MAX_TOTAL = 2_000_000_000

/** Busca el cliente por nombre (sin distinguir mayúsculas) o lo crea. */
export async function resolveCustomer(tx: Tx, businessId: string, name: string | undefined) {
  if (!name) return null
  const existing = await tx.customer.findFirst({
    where: { businessId, name: { equals: name, mode: "insensitive" } },
  })
  return existing ? existing.id : (await tx.customer.create({ data: { businessId, name } })).id
}

export type Line = {
  productId: string | null
  description: string
  quantity: number
  unitPrice: number
  unitCost: number
  subtotal: number
  trackStock: boolean
}

/** Valida que los productos sean de este negocio y arma las líneas con su costo. */
export async function buildLines(ctx: BusinessContext, items: SaleInput["items"]): Promise<Line[] | null> {
  const productIds = [...new Set(items.map((i) => i.productId).filter((id): id is string => Boolean(id)))]
  const products = productIds.length
    ? await db.product.findMany({ where: { businessId: ctx.businessId, id: { in: productIds } } })
    : []
  if (products.length !== productIds.length) return null
  const byId = new Map(products.map((p) => [p.id, p]))
  return items.map((item) => {
    const product = item.productId ? byId.get(item.productId) : undefined
    return {
      productId: product?.id ?? null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: product?.cost ?? 0,
      subtotal: item.quantity * item.unitPrice,
      trackStock: product?.trackStock ?? false,
    }
  })
}

/** Descuenta stock de las líneas con control de stock y registra el movimiento. */
export async function applyStock(tx: Tx, ctx: BusinessContext, saleId: string, lines: Line[], reason: string) {
  for (const line of lines) {
    if (!line.productId || !line.trackStock) continue
    await tx.product.update({ where: { id: line.productId }, data: { stock: { decrement: line.quantity } } })
    await tx.inventoryMovement.create({
      data: {
        businessId: ctx.businessId,
        productId: line.productId,
        type: "OUT",
        quantity: -line.quantity,
        reason,
        saleId,
        createdById: ctx.user.id,
      },
    })
  }
}

/** Devuelve al stock lo que la venta había descontado y borra esos movimientos. */
export async function revertStock(tx: Tx, saleId: string) {
  const movements = await tx.inventoryMovement.findMany({ where: { saleId } })
  for (const m of movements) {
    await tx.product.update({ where: { id: m.productId }, data: { stock: { increment: -m.quantity } } })
  }
  await tx.inventoryMovement.deleteMany({ where: { saleId } })
}

/** Vender al fiado es parte de Pro. Una venta que ya era fiada (de antes) se puede seguir editando. */
export const FIADO_PRO = "Vender al fiado es parte del plan Pro. Puedes contratarlo en Tu plan."
export function fiadoBlocked(ctx: BusinessContext, paymentMethod: string, previous?: string) {
  return paymentMethod === "FIADO" && previous !== "FIADO" && !canUseFeature(ctx.business.plan, "customers")
}

export const lineData = (l: Line) => ({
  productId: l.productId,
  description: l.description,
  quantity: l.quantity,
  unitPrice: l.unitPrice,
  unitCost: l.unitCost,
  subtotal: l.subtotal,
})
