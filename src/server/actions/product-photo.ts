"use server"

import { randomUUID } from "node:crypto"
import { put } from "@vercel/blob"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { parseImageDataUrl } from "@/lib/image-data"
import { idSchema } from "@/lib/validations"
import { allowAttempt } from "@/server/rate-limit"
import { deletePhoto, photosConfigured } from "@/server/product-photos"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, type ActionResult } from "@/server/actions/result"

const EXT: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" }

function revalidate() {
  revalidatePath("/dashboard", "layout")
  revalidatePath("/tienda/[slug]", "page")
}

/** Guarda la foto de un producto. Llega como "data:image/webp;base64,…" ya achicada en el celular. */
export async function uploadProductPhoto(productId: string, dataUrl: string): Promise<ActionResult<{ url: string }>> {
  if (!idSchema.safeParse(productId).success) return { ok: false, message: "Producto no encontrado." }
  const ctx = await requireBusiness()
  if (!photosConfigured()) return { ok: false, message: "Las fotos todavía no están activadas. Escríbenos y las activamos." }
  // Las versiones nuevas la mandan bajo 560 KB; se acepta hasta 1,5 MB por si llega de un teléfono con la versión anterior.
  const img = parseImageDataUrl(dataUrl, 1536 * 1024)
  if ("error" in img) return { ok: false, message: img.error! }
  try {
    assertCan(ctx, "products:manage")
    if (!(await allowAttempt(`foto-producto:${ctx.businessId}`, 120, 60 * 60_000))) {
      return { ok: false, message: "Subiste muchas fotos seguidas. Espera un rato e intenta de nuevo." }
    }
    const product = await db.product.findFirst({ where: { id: productId, businessId: ctx.businessId }, select: { imageUrl: true } })
    if (!product) return { ok: false, message: "Producto no encontrado." }
    // El nombre lleva una parte al azar: así nadie adivina la dirección de una foto antes de que se publique.
    const blob = await put(`productos/${ctx.businessId}/${productId}-${randomUUID()}.${EXT[img.type]}`, img.data, {
      access: "public",
      contentType: img.type,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    })
    await db.product.update({ where: { id: productId }, data: { imageUrl: blob.url } })
    await deletePhoto(product.imageUrl)
    revalidate()
    return { ok: true, message: "Foto guardada", data: { url: blob.url } }
  } catch (error) {
    return toActionError(error)
  }
}

export async function removeProductPhoto(productId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(productId).success) return { ok: false, message: "Producto no encontrado." }
  const ctx = await requireBusiness()
  try {
    assertCan(ctx, "products:manage")
    const product = await db.product.findFirst({ where: { id: productId, businessId: ctx.businessId }, select: { imageUrl: true } })
    if (!product) return { ok: false, message: "Producto no encontrado." }
    await db.product.update({ where: { id: productId }, data: { imageUrl: null } })
    await deletePhoto(product.imageUrl)
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Foto quitada" }
}
