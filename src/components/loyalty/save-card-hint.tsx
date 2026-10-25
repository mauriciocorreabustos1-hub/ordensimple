"use client"

import * as React from "react"
import { Smartphone } from "lucide-react"

function platform() {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios"
  if (/Android/i.test(ua)) return "android"
  return "other"
}

/** Cómo guardar la tarjeta en el celular (en la pantalla de inicio, como una app), según el teléfono. */
export function SaveCardHint() {
  const [os, setOs] = React.useState<"ios" | "android" | "other" | null>(null)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el teléfono solo se conoce en el navegador
    setOs(platform())
  }, [])
  // Abierta como app desde la pantalla de inicio: ya está guardada.
  const [installed, setInstalled] = React.useState(false)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- solo existe en el navegador
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true)
  }, [])
  if (!os || installed) return null

  return (
    <section className="space-y-2 rounded-2xl border bg-background p-4 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Smartphone className="size-4 text-primary" />
        Guárdala en tu celular
      </p>
      {os === "ios" ? (
        <p className="text-muted-foreground">
          En Safari toca <strong className="text-foreground">Compartir</strong> (el cuadrado con la flecha) y luego <strong className="text-foreground">Agregar a inicio</strong>. Tu tarjeta queda como una app.
        </p>
      ) : os === "android" ? (
        <p className="text-muted-foreground">
          En Chrome toca el menú <strong className="text-foreground">⋮</strong> y luego <strong className="text-foreground">Agregar a la pantalla principal</strong>. Tu tarjeta queda como una app.
        </p>
      ) : (
        <p className="text-muted-foreground">Abre este enlace en tu celular y agrégalo a la pantalla de inicio, o guárdalo en tus favoritos.</p>
      )}
    </section>
  )
}
