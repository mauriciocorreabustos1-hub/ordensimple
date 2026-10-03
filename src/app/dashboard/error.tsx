"use client"

import { RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border px-6 py-16 text-center">
      <TriangleAlert className="size-8 text-warning" />
      <div className="space-y-1">
        <p className="text-lg font-semibold">Algo no salió bien</p>
        <p className="text-sm text-muted-foreground">No pudimos cargar esta sección. Tus datos están a salvo.</p>
      </div>
      <Button onClick={reset}>
        <RotateCcw />
        Intentar de nuevo
      </Button>
    </div>
  )
}
