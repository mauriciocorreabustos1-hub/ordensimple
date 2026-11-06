import { Loader2 } from "lucide-react"

/** Mientras carga la guía tampoco se muestra el menú de la app (data-foco, ver globals.css). */
export default function Loading() {
  return (
    <div data-foco className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Cargando">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
