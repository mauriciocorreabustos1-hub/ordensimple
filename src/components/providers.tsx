"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import * as React from "react"
import { Toaster } from "@/components/ui/sonner"
import { isStaleVersionError, reloadForNewVersion } from "@/lib/stale-version"

/** Si una acción falla porque la pestaña tiene una versión vieja de la app, se recarga sola. */
function StaleVersionGuard() {
  React.useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleVersionError(e.reason) && reloadForNewVersion()) e.preventDefault()
    }
    const onError = (e: ErrorEvent) => {
      if (isStaleVersionError(e.error ?? e.message) && reloadForNewVersion()) e.preventDefault()
    }
    window.addEventListener("unhandledrejection", onRejection)
    window.addEventListener("error", onError)
    return () => {
      window.removeEventListener("unhandledrejection", onRejection)
      window.removeEventListener("error", onError)
    }
  }, [])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      {children}
      <StaleVersionGuard />
      <Toaster position="top-center" richColors closeButton />
    </TooltipProvider>
  )
}
