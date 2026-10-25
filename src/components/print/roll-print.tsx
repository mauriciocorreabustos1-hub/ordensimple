"use client"

import * as React from "react"
import { createPortal } from "react-dom"

// Impresión en papel de rollo (impresoras térmicas de boletas de 58 u 80 mm).
// La boleta sale pegada arriba y con el ancho del rollo como máximo, sea cual sea la hoja que use la impresora.
// El ancho se recuerda en cada aparato.

export type RollWidth = 58 | 80
const KEY = "ordensimple-rollo"
const listeners = new Set<() => void>()
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
 * No se pide un tamaño de hoja: muchas impresoras térmicas (por ejemplo, Xprinter en Windows) no aceptan tamaños a
 * medida, y entonces el navegador ponía la boleta al centro de su hoja larga, con mucho papel en blanco arriba.
 * Así la boleta parte arriba, con el ancho del rollo como máximo, y la impresora deja de avanzar donde termina.
 * Cada elemento con la clase "ticket" sale en su propio corte.
 */
export function RollPaper({ id, children }: { id: string; children: React.ReactNode }) {
  const [width] = useRollWidth()
  const font = width === 58 ? "9pt" : "10.5pt"
  if (typeof document === "undefined") return null
  return createPortal(
    <div id={id}>
      <style>{`
@media screen { #${id} { display: none } }
@media print {
  @page { margin: 0 }
  body > *:not(#${id}) { display: none !important }
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; width: auto !important; min-width: 0 !important; min-height: 0 !important; height: auto !important }
  #${id} { display: block; box-sizing: border-box; max-width: ${width}mm; margin: 0; padding: 1mm ${SIDE_MM}mm 0; font: ${font}/1.35 ui-monospace, "Courier New", monospace; color: #000 }
  #${id} .ticket { break-after: page; page-break-after: always }
  #${id} .ticket:last-child { break-after: auto; page-break-after: auto }
  #${id} .cut { display: none }
}`}</style>
      {children}
    </div>,
    document.body,
  )
}
