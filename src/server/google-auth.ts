import "server-only"
import { headers } from "next/headers"
import { GOOGLE_ENABLED } from "@/lib/auth"

/**
 * Si se muestra "Continuar con Google". No aparece:
 * - si todavía no están las claves de Google en Vercel;
 * - dentro de la app de Windows: Google no permite iniciar sesión dentro de una app así, y el enlace
 *   terminaría abriéndose en el navegador, sin dejar la sesión en la app.
 */
export async function showGoogle() {
  if (!GOOGLE_ENABLED) return false
  const ua = (await headers()).get("user-agent") ?? ""
  return !ua.includes("OrdenSimpleDesktop")
}
