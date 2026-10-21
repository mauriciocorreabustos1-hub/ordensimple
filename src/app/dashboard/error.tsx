"use client"

import * as React from "react"
import { RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { reportError } from "@/lib/report-error"
import { isStaleVersionError, reloadForNewVersion } from "@/lib/stale-version"

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    // Pestaña con una versión vieja de la app: se recarga sola en vez de mostrar el error.
    if (isStaleVersionError(error) && reloadForNewVersion()) return
    // Los errores con "digest" vienen del servidor y ya quedaron registrados allá.
    if (!error.digest) reportError(error)
  }, [error])

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border px-6 py-16 text-center">
      <TriangleAlert className="size-8 text-warning" />
      <div className="space-y-1">
        <p className="text-lg font-semibold">Algo no salió bien</p>
        <p className="text-sm text-muted-foreground">No pudimos cargar esta sección. Tus datos están a salvo y ya nos avisaron.</p>
      </div>
      <Button onClick={reset}>
        <RotateCcw />
        Intentar de nuevo
      </Button>
    </div>
  )
}
