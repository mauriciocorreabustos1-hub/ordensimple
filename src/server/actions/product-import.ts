"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { productLimit } from "@/lib/plans"
import { importBatchSchema, type ImportBatchInput, type ImportResult } from "@/lib/product-import"
import { findExisting } from "@/server/product-import"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, type ActionResult } from "@/server/actions/result"

/**
 * Guarda un lote de productos ya revisados (máximo 100). Todo se vuelve a validar aquí: la pantalla solo propone.
 * - Cada lote va en una transacción: o se guarda completo o no se guarda nada.
 * - Las importaciones del mismo negocio se hacen de a una (candado por negocio), así un doble clic no duplica.
 * - Si se corta y se reintenta, lo ya creado se reconoce por su código (o por el mismo nombre si no tiene código) y no
 *   se vuelve a crear.
 */
export async function importProductsBatch(input: ImportBatchInput): Promise<ActionResult<{ results: ImportResult[] }>> {
  const ctx = await requireBusiness()
  const parsed = importBatchSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Los datos del archivo no son válidos. Vuelve a subirlo." }
  const { rows, updateExisting, updateStock } = parsed.data

  try {
    assertCan(ctx, "products:manage")
    const results = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`importar-productos:${ctx.businessId}`}))`
        // Dentro de la misma transacción (después del candado), para ver lo que guardaron las importaciones anteriores.
        const match = await findExisting(tx, ctx.businessId, rows.map((r) => r.data))
        const limit = productLimit(ctx.business.plan, ctx.business.extraProducts)
        let room = limit === null ? Infinity : Math.max(0, limit - (await tx.product.count({ where: { businessId: ctx.businessId } })))
        const categories = new Map<string, string>()
        const categoryId = async (name: string | undefined) => {
          if (!name) return undefined
          const key = name.toLowerCase()
          if (!categories.has(key)) {
            const c = await tx.category.upsert({
              where: { businessId_name: { businessId: ctx.businessId, name } },
              create: { businessId: ctx.businessId, name },
              update: {},
              select: { id: true },
            })
            categories.set(key, c.id)
          }
          return categories.get(key)
        }
        // Códigos ya usados en este mismo lote (por si dos filas traen el mismo).
        const usedCodes = new Set<string>()
        const usedNames = new Set<string>()
        const out: ImportResult[] = []

        for (const { row, data } of rows) {
          const keys = data.codes.map((c) => c.toLowerCase())
          if (keys.some((k) => usedCodes.has(k)) || (!keys.length && usedNames.has(data.name.toLowerCase()))) {
            out.push({ row, name: data.name, result: "omitido", message: "Repetido en el archivo." })
            continue
          }
          keys.forEach((k) => usedCodes.add(k))
          if (!keys.length) usedNames.add(data.name.toLowerCase())

          const m = match(data)
          if (m.conflict) {
            out.push({ row, name: data.name, result: "error", message: m.conflict })
            continue
          }
          const found = m.product
          if (found) {
            // Solo se actualiza si la persona lo eligió, y solo con un código (un nombre igual no basta para identificarlo).
            if (!updateExisting || found.by !== "codigo") {
              out.push({ row, name: data.name, result: "omitido", message: found.by === "nombre" ? "Ya existe un producto con ese nombre." : "Ya existía." })
              continue
            }
            const current = await tx.product.findFirst({ where: { id: found.id, businessId: ctx.businessId }, select: { id: true, stock: true, trackStock: true } })
            if (!current) {
              out.push({ row, name: data.name, result: "error", message: "No encontramos el producto." })
              continue
            }
            const changeStock = updateStock && data.stock !== undefined && data.stock !== current.stock
            await tx.product.update({
              where: { id: current.id },
              data: {
                name: data.name,
                price: data.price,
                ...(data.cost !== undefined ? { cost: data.cost } : {}),
                ...(data.minStock !== undefined ? { minStock: data.minStock } : {}),
                ...(data.categoryName ? { categoryId: await categoryId(data.categoryName) } : {}),
                ...(changeStock ? { stock: data.stock, trackStock: true } : {}),
              },
            })
            if (changeStock) {
              await tx.inventoryMovement.create({
                data: {
                  businessId: ctx.businessId,
                  productId: current.id,
                  type: "ADJUSTMENT",
                  quantity: data.stock! - current.stock,
                  reason: "Ajuste por importación de productos",
                  createdById: ctx.user.id,
                },
              })
            }
            out.push({ row, name: data.name, result: "actualizado" })
            continue
          }

          if (room <= 0) {
            out.push({ row, name: data.name, result: "error", message: `Supera el límite de ${limit} productos de tu plan.` })
            continue
          }
          room--
          // Con stock o stock mínimo en el archivo se controla el stock; sin esos datos, no (así no aparece como agotado).
          const trackStock = data.stock !== undefined || data.minStock !== undefined
          const product = await tx.product.create({
            data: {
              businessId: ctx.businessId,
              name: data.name,
              sku: data.codes[0] ?? null,
              price: data.price,
              cost: data.cost ?? 0,
              stock: data.stock ?? 0,
              minStock: data.minStock ?? 0,
              trackStock,
              categoryId: (await categoryId(data.categoryName)) ?? null,
            },
            select: { id: true },
          })
          if (data.codes.length > 1) {
            await tx.productBarcode.createMany({ data: data.codes.slice(1).map((code) => ({ businessId: ctx.businessId, productId: product.id, code })) })
          }
          if (trackStock && (data.stock ?? 0) > 0) {
            await tx.inventoryMovement.create({
              data: {
                businessId: ctx.businessId,
                productId: product.id,
                type: "IN",
                quantity: data.stock!,
                reason: "Stock inicial (importación de productos)",
                createdById: ctx.user.id,
              },
            })
          }
          out.push({ row, name: data.name, result: "creado" })
        }
        return out
      },
      { timeout: 60_000, maxWait: 30_000 },
    )
    revalidatePath("/dashboard", "layout")
    return { ok: true, data: { results } }
  } catch (error) {
    return toActionError(error)
  }
}
