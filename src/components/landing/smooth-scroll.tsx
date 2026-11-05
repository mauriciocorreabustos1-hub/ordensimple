"use client"

import * as React from "react"
import type Lenis from "lenis"
import "lenis/dist/lenis.css"

const HEADER = 72

let current: Lenis | null = null

/** Baja o sube suave hasta esa posición, con Lenis si está activo (en celular, con el scroll normal). */
export function smoothScrollTo(top: number) {
  if (current) current.scrollTo(top)
  else window.scrollTo({ top, behavior: "smooth" })
}

/**
 * Scroll suave de las páginas públicas, solo con mouse o trackpad: en el celular queda el scroll normal y no se
 * descarga nada de esto. Avanza con el reloj de GSAP, para que las animaciones ligadas al scroll vayan a la par.
 */
export function SmoothScroll() {
  React.useEffect(() => {
    const media = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)")
    if (!media.matches) return
    let cleanup: (() => void) | undefined
    let cancelled = false
    void Promise.all([import("lenis"), import("gsap"), import("gsap/ScrollTrigger")]).then(([{ default: LenisClass }, { gsap }, { ScrollTrigger }]) => {
      if (cancelled) return
      gsap.registerPlugin(ScrollTrigger)
      const lenis = new LenisClass({ anchors: { offset: -HEADER }, allowNestedScroll: true })
      current = lenis
      lenis.on("scroll", ScrollTrigger.update)
      const tick = (time: number) => lenis.raf(time * 1000)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)
      cleanup = () => {
        gsap.ticker.remove(tick)
        gsap.ticker.lagSmoothing(500, 33)
        lenis.destroy()
        current = null
      }
    })
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])
  return null
}
