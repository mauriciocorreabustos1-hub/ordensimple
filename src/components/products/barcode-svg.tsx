import { barcodeModules } from "@/lib/barcode"

/** Código de barras en SVG. Ocupa todo el ancho disponible; las barras se juntan en rectángulos para que sea liviano. */
export function BarcodeSvg({ value, height, className }: { value: string; height: string; className?: string }) {
  const { bits } = barcodeModules(value)
  const quiet = 8
  const bars: { x: number; w: number }[] = []
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== "1") continue
    const last = bars[bars.length - 1]
    if (last && last.x + last.w === i + quiet) last.w++
    else bars.push({ x: i + quiet, w: 1 })
  }
  return (
    <svg
      viewBox={`0 0 ${bits.length + quiet * 2} 10`}
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label={`Código de barras ${value}`}
    >
      <rect width={bits.length + quiet * 2} height={10} fill="#fff" />
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={b.w} height={10} fill="#000" />
      ))}
    </svg>
  )
}
