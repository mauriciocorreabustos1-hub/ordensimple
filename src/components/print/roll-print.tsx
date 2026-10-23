"use client"

import * as React from "react"
import { createPortal } from "react-dom"

// Impresión en papel de rollo (impresoras térmicas de boletas de 58 u 80 mm).
// El papel se pide del ancho del rollo y del largo justo de lo impreso: así la impresora no suelta
// una hoja carta en blanco ni corta la boleta por la mitad. El ancho se recuerda en cada aparato.

export type RollWidth = 58 | 80
const KEY = "ordensimple-rollo"
const listeners = new Set<() => void>()
const PX_PER_MM = 96 / 25.4
/** Lo que se deja a cada lado (las térmicas no imprimen hasta el borde). */
const SIDE_MM = 3

function read(): RollWidth {
  try {
    return localStorage.getItem(KEY) === "58" ? 58 : 80
  } catch {
    return 80
  }
}

export function useRollWidth(): [RollWidth, (w: RollWidth) => void] {
  const width = React.useSyncExternalStore<RollWidth>(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => 80 as RollWidth,
  )
  const set = React.useCallback((w: RollWidth) => {
    try {
      localStorage.setItem(KEY, String(w))
    } catch {}
    listeners.forEach((l) => l())
  }, [])
  return [width, set]
}

/** Elegir el ancho del rollo de la impresora. */
export function RollWidthSelect({ className }: { className?: string }) {
  const [width, setWidth] = useRollWidth()
  return (
    <select
      value={width}
      onChange={(e) => setWidth(e.target.value === "58" ? 58 : 80)}
      aria-label="Ancho del papel de la impresora"
      className={className ?? "rounded-md border bg-background px-1.5 py-1 text-xs"}
    >
      <option value={80}>Rollo de 80 mm</option>
      <option value={58}>Rollo de 58 mm</option>
    </select>
  )
}

/**
 * El papel: solo se ve al imprimir, y al imprimir se ve solo él.
 * Cada elemento con la clase "ticket" sale en su propio corte; el largo del papel es el del ticket más largo.
 */
export function RollPaper({ id, children }: { id: string; children: React.ReactNode }) {
  const [width] = useRollWidth()
  const content = width - SIDE_MM * 2
  const font = width === 58 ? "9pt" : "10.5pt"
  const measure = React.useRef<HTMLDivElement>(null)
  const [heightMm, setHeightMm] = React.useState(150)

  // Se mide una copia invisible con el mismo ancho y letra que el papel, en cada cambio de lo que se imprime
  // (solo se actualiza si el largo cambió, así que no entra en un ciclo).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    const el = measure.current
    if (!el) return
    const tickets = [...el.querySelectorAll<HTMLElement>(".ticket")]
    const px = Math.max(...(tickets.length ? tickets : [el]).map((t) => t.offsetHeight))
    const mm = Math.ceil(px / PX_PER_MM) + 8
    if (mm !== heightMm) setHeightMm(mm)
  })

  if (typeof document === "undefined") return null
  const paperCss = `font: ${font}/1.35 ui-monospace, "Courier New", monospace; color: #000; width: ${content}mm;`
  return createPortal(
    <>
      <div ref={measure} aria-hidden className="roll-measure" style={{ position: "fixed", left: -10000, top: 0, visibility: "hidden", pointerEvents: "none" }}>
        <style>{`.roll-measure { ${paperCss} } .roll-measure .cut { display: none }`}</style>
        {children}
      </div>
      <div id={id}>
        {/* Con una clave nueva el navegador vuelve a leer el tamaño del papel (si solo cambia el texto, se queda con el anterior). */}
        <style key={`${width}x${heightMm}`}>{`
@media screen { #${id} { display: none } }
@media print {
  @page { size: ${width}mm ${heightMm}mm; margin: 0 }
  body > *:not(#${id}) { display: none !important }
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; width: ${width}mm !important; min-width: 0 !important }
  #${id} { display: block; ${paperCss} margin: 0 ${SIDE_MM}mm; padding-top: 3mm }
  #${id} .ticket { break-after: page; page-break-after: always }
  #${id} .ticket:last-child { break-after: auto; page-break-after: auto }
  #${id} .cut { display: none }
}`}</style>
        {children}
      </div>
    </>,
    document.body,
  )
}
