"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { parseImageDataUrl } from "@/lib/image-data"
import { requireUser } from "@/server/session"
import { toActionError, type ActionResult } from "@/server/actions/result"

/** Guarda la foto de perfil (ya achicada y recortada en el navegador). */
export async function uploadUserPhoto(dataUrl: string): Promise<ActionResult> {
  const user = await requireUser()
  const img = parseImageDataUrl(dataUrl)
  if ("error" in img) return { ok: false, message: img.error! }
  try {
    await db.$transaction([
      db.userPhoto.upsert({ where: { userId: user.id }, create: { userId: user.id, data: img.data, type: img.type }, update: { data: img.data, type: img.type } }),
      db.user.update({ where: { id: user.id }, data: { image: `/foto/${user.id}?v=${Date.now()}` } }),
    ])
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/", "layout")
  return { ok: true, message: "Foto guardada" }
}

export async function removeUserPhoto(): Promise<ActionResult> {
  const user = await requireUser()
  try {
    await db.$transaction([db.userPhoto.deleteMany({ where: { userId: user.id } }), db.user.update({ where: { id: user.id }, data: { image: null } })])
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/", "layout")
  return { ok: true, message: "Foto quitada" }
}
