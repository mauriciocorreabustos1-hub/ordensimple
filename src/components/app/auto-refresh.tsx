"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

/** Vuelve a cargar los datos de la página cada cierto tiempo mientras está a la vista (y al volver a ella). */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter()
  React.useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh()
    const t = setInterval(refresh, seconds * 1000)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [router, seconds])
  return null
}
