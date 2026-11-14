"use server"

import { roundQuantity } from "@/lib/units"
import { revalidatePath } from "next/cache"
import { zonedTimeToUtc } from "@/lib/dates"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { deletePhoto } from "@/server/product-photos"
import { PLANS, productLimit } from "@/lib/plans"
import { cleanCodes } from "@/lib/barcodes"
import { idSchema, productSchema, type ProductInput } from "@/lib/validations"
import { assertCan, requireBusiness, type BusinessContext } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

async function resolveCategory(ctx: BusinessContext, name: string | undefined) {
  if (!name) return null
  const category = await db.category.upsert({
    where: { businessId_name: { businessId: ctx.businessId, name } },
    create: { businessId: ctx.businessId, name },
    update: {},
  })
  return category.id
}

/**
 * Códigos del producto: el primero queda como principal (sku) y el resto como adicionales.
 * Devuelve un mensaje si alguno ya lo usa otro producto del negocio.
 */
async function prepareCodes(ctx: BusinessContext, codesInput: string[] | undefined, sku: string | undefined, productId?: string) {
  const codes = cleanCodes(codesInput ?? [sku])
  if (codes.length) {
    const notThis = productId ? { not: productId } : undefined
    const [bySku, byBarcode] = await Promise.all([
      db.product.findFirst({
        where: { businessId: ctx.businessId, id: notThis, sku: { in: codes, mode: "insensitive" } },
        select: { name: true, sku: true },
      }),
      db.productBarcode.findFirst({
        where: { businessId: ctx.businessId, productId: notThis, code: { in: codes, mode: "insensitive" } },
        select: { code: true, product: { select: { name: true } } },
      }),
    ])
    const taken = bySku ? { code: bySku.sku, name: bySku.name } : byBarcode ? { code: byBarcode.code, name: byBarcode.product.name } : null
    if (taken) return { error: `El código ${taken.code} ya está en el producto "${taken.name}".` }
  }
  return { sku: codes[0] ?? null, extra: codes.slice(1) }
}

function isUniqueSkuError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/** "AAAA-MM-DD" → fecha (a mediodía en la zona del negocio); vacío = sin fecha. */
function expiryDate(key: string | undefined, timezone: string) {
  if (!key) return null
  const [y, m, d] = key.split("-").map(Number)
  return zonedTimeToUtc(y, m, d, timezone, 12)
}

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { categoryName, codes, ...data } = parsed.data
  // Un servicio no lleva stock ni vencimiento, y siempre tiene duración (para la Agenda y las reservas).
  if (data.isService) Object.assign(data, { trackStock: false, stock: 0, minStock: 0, expiresAt: "", durationMin: data.durationMin ?? 30 })
  else data.durationMin = null
  const noun = data.isService ? "Servicio" : "Producto"
  // Por unidad, el stock va en enteros; por kilo o metro, hasta gramos o centímetros.
  if (data.saleUnit === "u" && (!Number.isInteger(data.stock) || !Number.isInteger(data.minStock))) {
    return { ok: false, message: "Este producto se vende por unidad: el stock va en números enteros.", fieldErrors: { stock: ["Usa números enteros"] } }
  }
  data.stock = roundQuantity(data.stock, data.saleUnit)
  data.minStock = roundQuantity(data.minStock, data.saleUnit)

  try {
    assertCan(ctx, "products:manage")

    const limit = productLimit(ctx.business.plan, ctx.business.extraProducts)
    if (limit !== null) {
      const count = await db.product.count({ where: { businessId: ctx.businessId } })
      if (count >= limit) {
        return {
          ok: false,
          message: `El plan ${PLANS[ctx.business.plan].name} permite hasta ${limit} productos. Con Pro tienes productos ilimitados.`,
        }
      }
    }

    const prepared = await prepareCodes(ctx, codes, data.sku)
    if ("error" in prepared) return { ok: false, message: prepared.error! }
    const categoryId = await resolveCategory(ctx, categoryName)
    await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { ...data, sku: prepared.sku, expiresAt: expiryDate(data.expiresAt, ctx.timezone), categoryId, businessId: ctx.businessId },
      })
      if (prepared.extra.length) {
        await tx.productBarcode.createMany({
          data: prepared.extra.map((code) => ({ businessId: ctx.businessId, productId: product.id, code })),
        })
      }
      if (data.trackStock && data.stock > 0) {
        await tx.inventoryMovement.create({
          data: {
            businessId: ctx.businessId,
            productId: product.id,
            type: "IN",
            quantity: data.stock,
            reason: "Stock inicial",
            createdById: ctx.user.id,
          },
        })
      }
    })
  } catch (error) {
    if (isUniqueSkuError(error)) return { ok: false, message: "Ese código de barras ya está en otro producto." }
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: `${noun} creado` }
}

export async function updateProduct(id: string, input: ProductInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  const parsed = productSchema.safeParse(input)
  if (!parsedId.success) return { ok: false, message: "Producto no encontrado." }
  if (!parsed.success) return validationError(parsed.error)
  const { categoryName, codes, ...data } = parsed.data
  // Un servicio no lleva stock ni vencimiento, y siempre tiene duración (para la Agenda y las reservas).
  if (data.isService) Object.assign(data, { trackStock: false, stock: 0, minStock: 0, expiresAt: "", durationMin: data.durationMin ?? 30 })
  else data.durationMin = null
  const noun = data.isService ? "Servicio" : "Producto"
  // Por unidad, el stock va en enteros; por kilo o metro, hasta gramos o centímetros.
  if (data.saleUnit === "u" && (!Number.isInteger(data.stock) || !Number.isInteger(data.minStock))) {
    return { ok: false, message: "Este producto se vende por unidad: el stock va en números enteros.", fieldErrors: { stock: ["Usa números enteros"] } }
  }
  data.stock = roundQuantity(data.stock, data.saleUnit)
  data.minStock = roundQuantity(data.minStock, data.saleUnit)

  try {
    assertCan(ctx, "products:manage")
    const current = await db.product.findFirst({ where: { id: parsedId.data, businessId: ctx.businessId } })
    if (!current) return { ok: false, message: "Producto no encontrado." }

    const prepared = await prepareCodes(ctx, codes, data.sku, current.id)
    if ("error" in prepared) return { ok: false, message: prepared.error! }
    const categoryId = await resolveCategory(ctx, categoryName)
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: current.id },
        data: { ...data, sku: prepared.sku, expiresAt: expiryDate(data.expiresAt, ctx.timezone), categoryId },
      })
      // Se reemplazan los códigos adicionales por la lista nueva (si no vino la lista, se dejan como están).
      if (codes !== undefined) await tx.productBarcode.deleteMany({ where: { productId: current.id } })
      if (codes !== undefined && prepared.extra.length) {
        await tx.productBarcode.createMany({
          data: prepared.extra.map((code) => ({ businessId: ctx.businessId, productId: current.id, code })),
        })
      }
      const diff = roundQuantity(data.stock - current.stock, data.saleUnit)
      if (data.trackStock && diff !== 0) {
        await tx.inventoryMovement.create({
          data: {
            businessId: ctx.businessId,
            productId: current.id,
            type: "ADJUSTMENT",
            quantity: diff,
            reason: "Ajuste manual",
            createdById: ctx.user.id,
          },
        })
      }
    })
  } catch (error) {
    if (isUniqueSkuError(error)) return { ok: false, message: "Ese código de barras ya está en otro producto." }
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: `${noun} actualizado` }
}

export async function toggleProductActive(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Producto no encontrado." }

  try {
    assertCan(ctx, "products:manage")
    const { count } = await db.product.updateMany({
      where: { id: parsedId.data, businessId: ctx.businessId },
      data: { active: Boolean(active) },
    })
    if (count === 0) return { ok: false, message: "Producto no encontrado." }
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: active ? "Producto activado" : "Producto desactivado" }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Producto no encontrado." }

  try {
    assertCan(ctx, "products:manage")
    // Las ventas antiguas conservan el nombre y precio; solo pierden el vínculo con el producto.
    const photo = await db.product.findFirst({ where: { id: parsedId.data, businessId: ctx.businessId }, select: { imageUrl: true } })
    const { count } = await db.product.deleteMany({ where: { id: parsedId.data, businessId: ctx.businessId } })
    if (count === 0) return { ok: false, message: "Producto no encontrado." }
    // Su foto ya no se usa: se borra para no pagar por guardarla.
    await deletePhoto(photo?.imageUrl)
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Producto eliminado" }
}
