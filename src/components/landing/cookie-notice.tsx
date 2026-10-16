"use client"

import * as React from "react"
import Link from "next/link"
import { Cookie } from "lucide-react"
import { Button } from "@/components/ui/button"

const KEY = "ordensimple-aviso-cookies"

/**
 * Aviso discreto la primera vez que alguien entra: qué cookies usamos (solo propias, sin publicidad).
 * Que ya lo vio se guarda en este dispositivo (no en una cookie).
 */
export function CookieNotice() {
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee del dispositivo solo al abrir la página
      if (!localStorage.getItem(KEY)) setShow(true)
    } catch {}
  }, [])

  function close() {
    setShow(false)
    try {
      localStorage.setItem(KEY, "1")
    } catch {}
  }

  if (!show) return null
  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-50 flex items-start gap-3 rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur sm:right-auto sm:left-4 sm:max-w-sm"
    >
      <Cookie className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="space-y-3 text-sm">
        <p className="text-pretty text-muted-foreground">
          Usamos cookies propias para mantener tu sesión y saber cómo nos conociste. Sin publicidad ni terceros.{" "}
          <Link href="/privacidad#cookies" className="font-medium text-primary underline-offset-4 hover:underline">
            Más información
          </Link>
        </p>
        <Button size="sm" onClick={close}>
          Entendido
        </Button>
      </div>
    </div>
  )
}
