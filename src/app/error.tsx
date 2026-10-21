"use client"

import * as React from "react"
import Link from "next/link"
import { RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { reportError } from "@/lib/report-error"
import { isStaleVersionError, reloadForNewVersion } from "@/lib/stale-version"

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    // Pestaña con una versión vieja de la app: se recarga sola en vez de mostrar el error.
    if (isStaleVersionError(error) && reloadForNewVersion()) return
    if (!error.digest) reportError(error)
  }, [error])

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <TriangleAlert className="size-8 text-warning" />
      <div className="space-y-1">
        <p className="text-lg font-semibold">Algo no salió bien</p>
        <p className="text-sm text-muted-foreground">Ya nos avisaron y lo vamos a revisar. Intenta de nuevo en unos segundos.</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCcw />
          Intentar de nuevo
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  )
}
