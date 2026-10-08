"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, type ActionResult } from "@/server/actions/result"

const TYPES = ["image/webp", "image/png", "image/jpeg"] as const
/** El navegador ya lo achica a 256 px; esto es solo un tope de seguridad. */
const MAX_BYTES = 300 * 1024

/** Guarda el logo del negocio. Llega como "data:image/webp;base64,…" ya achicado en el navegador. */
export async function uploadBusinessLogo(dataUrl: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const match = /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "")
  if (!match || !TYPES.includes(match[1] as (typeof TYPES)[number])) return { ok: false, message: "Usa una imagen PNG, JPG o WebP." }
  const data = Buffer.from(match[2], "base64")
  if (data.length > MAX_BYTES) return { ok: false, message: "La imagen es muy pesada. Prueba con otra más chica." }
  try {
    assertCan(ctx, "settings:manage")
    await db.$transaction([
      db.businessLogo.upsert({
        where: { businessId: ctx.businessId },
        create: { businessId: ctx.businessId, data, type: match[1] },
        update: { data, type: match[1] },
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
