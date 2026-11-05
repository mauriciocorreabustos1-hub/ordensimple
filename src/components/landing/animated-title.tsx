"use client"

import * as React from "react"
import dynamic from "next/dynamic"

const SplitText = dynamic(() => import("@/components/reactbits/split-text"), { ssr: false })

const QUERY = "(pointer: fine) and (min-width: 1024px) and (prefers-reduced-motion: no-preference)"

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/**
 * Título que entra línea por línea, solo en computador: en el celular es un título normal y no se descarga GSAP.
 * El texto siempre está en el HTML del servidor, para Google y para quien no tenga animaciones.
 */
export function AnimatedTitle({ text, tag: Tag = "h2", className, align = "left" }: { text: string; tag?: "h2" | "p"; className?: string; align?: "left" | "center" }) {
  const fancy = React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
  if (!fancy) return <Tag className={className}>{text}</Tag>
  return <SplitText tag={Tag} text={text} splitType="lines" mask textAlign={align} delay={110} duration={0.9} threshold={0.15} rootMargin="0px" className={className} />
}
