"use server"

import { redirect } from "next/navigation"
import { unsubscribeUser } from "@/server/unsubscribe"

/** Botón "Dejar de recibir ofertas" de la página /baja (no requiere iniciar sesión). */
export async function confirmUnsubscribe(formData: FormData) {
  const u = formData.get("u")
  const t = formData.get("t")
  const ok = await unsubscribeUser(u, t)
  redirect(ok ? "/baja?listo=1" : "/baja?error=1")
}
