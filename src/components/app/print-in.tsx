"use client"

import * as React from "react"

/**
 * La boleta sale impresa cuando aparece en pantalla (una vez). Sin JavaScript o con "reducir movimiento" se ve
 * entera desde el principio: solo se esconde si todavía no está a la vista cuando carga la página.
 */
export function PrintIn({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = ref.current
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const run = () => el.setAttribute("data-print", "run")
    const r = el.getBoundingClientRect()
    if (r.top < innerHeight * 0.6) return void run()
    el.setAttribute("data-print", "wait")
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          run()
          io.disconnect()
        }
      },
      { rootMargin: "0px 0px -30% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
