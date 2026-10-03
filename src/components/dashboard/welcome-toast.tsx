"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

/** Muestra un saludo tras el onboarding y limpia el parámetro de la URL. */
export function WelcomeToast() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const shown = React.useRef(false)

  React.useEffect(() => {
    if (params.get("bienvenida") && !shown.current) {
      shown.current = true
      toast.success("¡Tu negocio está listo!", {
        description: "Empieza registrando tu primera venta con el botón verde.",
      })
      router.replace(pathname, { scroll: false })
    }
  }, [params, router, pathname])

  return null
}
