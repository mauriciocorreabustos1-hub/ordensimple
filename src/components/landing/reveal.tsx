"use client"

import * as React from "react"

/** El dibujo de una función sube y se asienta la primera vez que aparece en pantalla. Lo hace el navegador, sin librerías. */
export function Reveal({ className, children }: { className?: string; children: React.ReactNode }) {
  const root = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = root.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      el.animate(
        [
          { opacity: 0, transform: "translateY(56px) scale(0.98)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      )
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  )
}
