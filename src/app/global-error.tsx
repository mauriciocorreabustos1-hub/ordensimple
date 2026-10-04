"use client"

import * as React from "react"
import { reportError } from "@/lib/report-error"

// Último recurso: falla el diseño base de la página. Usa estilos mínimos en línea.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    if (!error.digest) reportError(error)
  }, [error])

  return (
    <html lang="es-CL">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22 }}>Algo no salió bien</h1>
          <p style={{ color: "#5b6b66" }}>Ya nos avisaron. Intenta de nuevo en unos segundos.</p>
          <button
            onClick={reset}
            style={{ marginTop: 12, padding: "10px 18px", borderRadius: 10, border: 0, background: "#007653", color: "#fff", fontSize: 15 }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  )
}
