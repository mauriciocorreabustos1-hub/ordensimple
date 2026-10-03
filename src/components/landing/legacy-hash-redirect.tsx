"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

// Los links antiguos usaban anclas (/#precios). El navegador no envía el "#" al servidor,
// así que se redirigen aquí a la página correspondiente.
const ROUTES: Record<string, string> = {
  "#funciones": "/funciones",
  "#como-funciona": "/como-funciona",
  "#precios": "/precios",
  "#preguntas": "/preguntas-frecuentes",
}

export function LegacyHashRedirect() {
  const router = useRouter()
  React.useEffect(() => {
    const target = ROUTES[window.location.hash]
    if (target) router.replace(target)
  }, [router])
  return null
}
