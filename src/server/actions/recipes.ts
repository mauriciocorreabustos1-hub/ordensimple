"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { PLANS, productLimit } from "@/lib/plans"
import { recipeTotals } from "@/lib/recipes"
import { idSchema, recipeMaterialSchema, recipeSchema, type RecipeInput, type RecipeMaterialInput } from "@/lib/validations"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

// Recetas y sus materiales. Gratis en todos los planes.

const MAX_MATERIALS = 500
const MAX_RECIPES = 300

function revalidate() {
  revalidatePath("/dashboard/recetas")
}

const isDuplicate = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

export async function saveRecipeMaterial(id: string | null, input: RecipeMaterialInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusiness()
  const parsed = recipeMaterialSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  if (id && !idSchema.safeParse(id).success) return { ok: false, message: "Material no encontrado." }
  const data = { ...parsed.data, stock: parsed.data.stock ?? null }
  try {
    assertCan(ctx, "products:manage")
    if (id) {
      const { count } = await db.recipeMaterial.updateMany({ where: { id, businessId: ctx.businessId }, data })
      if (!count) return { ok: false, message: "Material no encontrado." }
      revalidate()
      return { ok: true, message: "Material guardado", data: { id } }
    }
    if ((await db.recipeMaterial.count({ where: { businessId: ctx.businessId } })) >= MAX_MATERIALS) {
      return { ok: false, message: `Puedes tener hasta ${MAX_MATERIALS} materiales.` }
    }
    const created = await db.recipeMaterial.create({ data: { ...data, businessId: ctx.businessId }, select: { id: true } })
    revalidate()
    return { ok: true, message: "Material agregado", data: { id: created.id } }
  } catch (error) {
    if (isDuplicate(error)) return { ok: false, message: "Ya tienes un material con ese nombre." }
    return toActionError(error)
  }
}

export async function deleteRecipeMaterial(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Material no encontrado." }
  try {
    assertCan(ctx, "products:manage")
    // Se quita también de las recetas que lo usaban.
    const { count } = await db.recipeMaterial.deleteMany({ where: { id, businessId: ctx.businessId } })
    if (!count) return { ok: false, message: "Material no encontrado." }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Material eliminado" }
}

export async function saveRecipe(id: string | null, input: RecipeInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusiness()
  const parsed = recipeSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  if (id && !idSchema.safeParse(id).success) return { ok: false, message: "Receta no encontrada." }
  const { items, ...data } = parsed.data
  try {
    assertCan(ctx, "products:manage")
    // Los materiales tienen que ser de este negocio y la medida tiene que corresponder (gramos con kilos, etc.).
    const materials = await db.recipeMaterial.findMany({
      where: { businessId: ctx.businessId, id: { in: [...new Set(items.map((i) => i.materialId))] } },
      select: { id: true, unit: true },
    })
    const unitOf = new Map(materials.map((m) => [m.id, m.unit]))
    const group = (u: string) => (u === "g" || u === "kg" ? "peso" : u === "ml" || u === "l" ? "volumen" : "unidad")
    for (const i of items) {
      const unit = unitOf.get(i.materialId)
      if (!unit) return { ok: false, message: "Uno de los materiales ya no existe. Recarga la página." }
      if (group(unit) !== group(i.unit)) return { ok: false, message: "Revisa las medidas: un ingrediente está en una medida que no corresponde a su material." }
    }

    const result = await db.$transaction(async (tx) => {
      if (id) {
        const { count } = await tx.recipe.updateMany({ where: { id, businessId: ctx.businessId }, data })
        if (!count) return null
        await tx.recipeItem.deleteMany({ where: { recipeId: id } })
        await tx.recipeItem.createMany({ data: items.map((i) => ({ ...i, recipeId: id })) })
        return id
      }
      if ((await tx.recipe.count({ where: { businessId: ctx.businessId } })) >= MAX_RECIPES) return "limit"
      const created = await tx.recipe.create({ data: { ...data, businessId: ctx.businessId, items: { create: items } }, select: { id: true } })
      return created.id
    })
    if (result === null) return { ok: false, message: "Receta no encontrada." }
    if (result === "limit") return { ok: false, message: `Puedes tener hasta ${MAX_RECIPES} recetas.` }
    revalidate()
    return { ok: true, message: "Receta guardada", data: { id: result } }
  } catch (error) {
    if (isDuplicate(error)) return { ok: false, message: "Ya tienes una receta con ese nombre." }
    return toActionError(error)
  }
}

export async function deleteRecipe(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Receta no encontrada." }
  try {
    assertCan(ctx, "products:manage")
    const { count } = await db.recipe.deleteMany({ where: { id, businessId: ctx.businessId } })
    if (!count) return { ok: false, message: "Receta no encontrada." }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Receta eliminada" }
}

/**
 * Pasa el precio de venta y el costo por unidad de la receta a un producto del catálogo (o crea uno nuevo con ellos).
 * Los montos se calculan de nuevo aquí con los datos guardados.
 */
export async function applyRecipeToProduct(recipeId: string, target: { productId: string } | { newName: string }): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(recipeId).success) return { ok: false, message: "Receta no encontrada." }
  try {
    assertCan(ctx, "products:manage")
    const recipe = await db.recipe.findFirst({
      where: { id: recipeId, businessId: ctx.businessId },
      include: { items: { include: { material: true } } },
    })
    if (!recipe) return { ok: false, message: "Receta no encontrada. Guárdala primero." }
    const totals = recipeTotals(recipe.items, recipe.yieldUnits, recipe.overheadPct, recipe.profitPct)
    const price = Math.round(totals.unitPrice)
    const cost = Math.round(totals.unitCost)
    if (price <= 0) return { ok: false, message: "La receta todavía no tiene precio: revisa los ingredientes." }

    let productId: string
    let name: string
    if ("productId" in target) {
      const product = await db.product.findFirst({ where: { id: target.productId, businessId: ctx.businessId, isService: false }, select: { id: true, name: true } })
      if (!product) return { ok: false, message: "Ese producto ya no existe." }
      await db.product.update({ where: { id: product.id }, data: { price, cost } })
      productId = product.id
      name = product.name
    } else {
      name = target.newName.trim().slice(0, 100)
      if (name.length < 2) return { ok: false, message: "Escribe el nombre del producto." }
      const limit = productLimit(ctx.business.plan, ctx.business.extraProducts)
      if (limit !== null && (await db.product.count({ where: { businessId: ctx.businessId } })) >= limit) {
        return { ok: false, message: `El plan ${PLANS[ctx.business.plan].name} permite hasta ${limit} productos. Con Pro tienes productos ilimitados.` }
      }
      // Lo que se elabora no parte con stock: se puede activar después en Productos.
      const created = await db.product.create({ data: { businessId: ctx.businessId, name, price, cost, trackStock: false }, select: { id: true } })
      productId = created.id
    }
    await db.recipe.update({ where: { id: recipe.id }, data: { productId } })
    revalidatePath("/dashboard", "layout")
    return { ok: true, message: `${name}: precio y costo actualizados` }
  } catch (error) {
    return toActionError(error)
  }
}
