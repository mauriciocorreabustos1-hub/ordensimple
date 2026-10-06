"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { PLANS, productLimit } from "@/lib/plans"
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

function isUniqueSkuError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { categoryName, ...data } = parsed.data

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

    const categoryId = await resolveCategory(ctx, categoryName)
    await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { ...data, sku: data.sku ?? null, categoryId, businessId: ctx.businessId },
      })
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
    if (isUniqueSkuError(error)) return { ok: false, message: "Ya tienes otro producto con ese código (SKU)." }
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Producto creado" }
}

export async function updateProduct(id: string, input: ProductInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  const parsed = productSchema.safeParse(input)
  if (!parsedId.success) return { ok: false, message: "Producto no encontrado." }
  if (!parsed.success) return validationError(parsed.error)
  const { categoryName, ...data } = parsed.data

  try {
    assertCan(ctx, "products:manage")
    const current = await db.product.findFirst({ where: { id: parsedId.data, businessId: ctx.businessId } })
    if (!current) return { ok: false, message: "Producto no encontrado." }

    const categoryId = await resolveCategory(ctx, categoryName)
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: current.id },
        data: { ...data, sku: data.sku ?? null, categoryId },
      })
      const diff = data.stock - current.stock
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
    if (isUniqueSkuError(error)) return { ok: false, message: "Ya tienes otro producto con ese código (SKU)." }
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Producto actualizado" }
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
    const { count } = await db.product.deleteMany({ where: { id: parsedId.data, businessId: ctx.businessId } })
    if (count === 0) return { ok: false, message: "Producto no encontrado." }
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Producto eliminado" }
}
