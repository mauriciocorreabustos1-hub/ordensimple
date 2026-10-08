"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { parseImageDataUrl } from "@/lib/image-data"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, type ActionResult } from "@/server/actions/result"

/** Guarda el logo del negocio. Llega como "data:image/webp;base64,…" ya achicado en el navegador. */
export async function uploadBusinessLogo(dataUrl: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const img = parseImageDataUrl(dataUrl)
  if ("error" in img) return { ok: false, message: img.error! }
  const { data, type } = img
  try {
    assertCan(ctx, "settings:manage")
    await db.$transaction([
      db.businessLogo.upsert({
        where: { businessId: ctx.businessId },
        create: { businessId: ctx.businessId, data, type },
        update: { data, type },
      }),
      db.business.update({ where: { id: ctx.businessId }, data: { logoUpdatedAt: new Date() } }),
    ])
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Logo guardado" }
}

export async function removeBusinessLogo(): Promise<ActionResult> {
  const ctx = await requireBusiness()
  try {
    assertCan(ctx, "settings:manage")
    await db.$transaction([
      db.businessLogo.deleteMany({ where: { businessId: ctx.businessId } }),
      db.business.update({ where: { id: ctx.businessId }, data: { logoUpdatedAt: null } }),
    ])
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Logo quitado" }
}
