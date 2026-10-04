"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAdmin } from "@/server/admin"
import type { ActionResult } from "@/server/actions/result"

/** Borra el registro de errores (después de revisarlos). Solo administradores. */
export async function clearErrorLog(): Promise<ActionResult> {
  await requireAdmin()
  const { count } = await db.errorLog.deleteMany({})
  revalidatePath("/admin")
  return { ok: true, message: count ? `Se limpiaron ${count} errores` : "No había errores" }
}
