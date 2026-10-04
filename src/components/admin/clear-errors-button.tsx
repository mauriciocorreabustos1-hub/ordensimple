"use client"

import * as React from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { clearErrorLog } from "@/server/actions/admin"

export function ClearErrorsButton() {
  const [pending, startTransition] = React.useTransition()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("¿Limpiar todos los errores registrados? Hazlo después de revisarlos.")) return
        startTransition(async () => {
          const r = await clearErrorLog()
          toast.success(r.message ?? "Listo")
        })
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      Limpiar
    </Button>
  )
}
