"use client"

import { toast } from "sonner"

// Si alguien tenía la app abierta antes de que publicáramos una versión nueva, al guardar algo el servidor ya no
// reconoce la acción ("Server Action … was not found"). En vez de mostrar ese error, se recarga la página sola.

const KEY = "ordensimple-recarga-version"

export function isStaleVersionError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  return /Server Action .* was not found|failed-to-find-server-action|Failed to find Server Action/i.test(message)
}

/** Recarga una vez (si ya se recargó hace poco, no insiste para no quedar en un ciclo). */
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Sin sessionStorage igual se recarga.
  }
  toast.info("Hay una versión nueva de OrdenSimple. Actualizando…", { duration: 4000 })
  setTimeout(() => window.location.reload(), 1200)
  return true
}
