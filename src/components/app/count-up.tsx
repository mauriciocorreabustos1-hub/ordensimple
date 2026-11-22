"use client"

import * as React from "react"

// Montos en pesos como "$1.791.850" o "−$48.280": signo y prefijo, los dígitos con puntos de miles y lo que siga.
const MONEY = /^([^\d]*)(\d{1,3}(?:\.\d{3})*)([^\d]*)$/

/**
 * Un monto que sube contando desde cero la primera vez que se ve. El servidor ya lo dibuja con su valor final
 * (así se lee aunque no cargue nada); si el formato no es de miles con punto, o la persona pidió reducir el
 * movimiento, se muestra tal cual.
 */
export function CountUp({ value, duration = 900, className }: { value: string; duration?: number; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    const el = ref.current
    const m = MONEY.exec(value)
    if (!el || !m || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const [, prefix, digits, suffix] = m
    const target = Number(digits.replaceAll(".", ""))
    if (!target) return
    const fmt = (n: number) => `${prefix}${Math.round(n).toLocaleString("es-CL")}${suffix}`
    let raf = 0
    const start = () => {
      const t0 = performance.now()
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration)
        el.textContent = fmt(target * (1 - Math.pow(1 - p, 4)))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      el.textContent = fmt(0)
      raf = requestAnimationFrame(tick)
    }
    // Cuenta cuando ya está bien a la vista (en la boleta, junto con la impresión).
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          start()
          io.disconnect()
        }
      },
      { rootMargin: "0px 0px -30% 0px" },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      el.textContent = value
    }
  }, [value, duration])

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  )
}
