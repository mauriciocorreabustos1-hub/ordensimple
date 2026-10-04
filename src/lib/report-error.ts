"use client"

/** Envía un error del navegador a /api/errores. No hace nada si falla. */
export function reportError(error: Error & { digest?: string }) {
  try {
    void fetch("/api/errores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        message: error.message || "Error en el navegador",
        digest: error.digest,
        path: window.location.pathname,
        stack: error.stack?.slice(0, 4000),
      }),
    }).catch(() => {})
  } catch {
    // Nada que hacer.
  }
}
