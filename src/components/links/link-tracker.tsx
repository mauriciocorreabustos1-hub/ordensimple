"use client"

import * as React from "react"

// Páginas ya contadas en esta visita (por si el efecto corre dos veces, no se manda la visita repetida).
const counted = new Set<string>()

/**
 * Cuenta la visita y los clics de la página pública. Se manda con sendBeacon (no frena la navegación) y solo
 * desde un navegador de verdad: los programas que leen la página sin ejecutarla no suman visitas.
 * No usa cookies ni guarda nada en el navegador.
 */
export function LinkTracker({ slug }: { slug: string }) {
  React.useEffect(() => {
    const send = (body: Record<string, unknown>) => {
      const data = JSON.stringify({ slug, ...body })
      try {
        if (navigator.sendBeacon?.("/api/links/evento", new Blob([data], { type: "text/plain" }))) return
      } catch {}
      fetch("/api/links/evento", { method: "POST", body: data, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {})
    }
    if (!counted.has(slug)) {
      counted.add(slug)
      send({ kind: "VIEW", ref: document.referrer || null, search: location.search || null })
    }
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-lk]")
      const blockId = el?.getAttribute("data-lk")
      if (blockId) send({ kind: "CLICK", blockId })
    }
    document.addEventListener("click", onClick, { capture: true })
    return () => document.removeEventListener("click", onClick, { capture: true })
  }, [slug])
  return null
}
