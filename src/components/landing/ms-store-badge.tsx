import { cn } from "@/lib/utils"
import { MS_STORE_URL } from "@/lib/desktop"

/** Botón oficial "Descargar desde Microsoft Store" (oscuro en el tema claro y claro en el oscuro). */
export function MsStoreBadge({ className, height = 52 }: { className?: string; height?: number }) {
  const width = Math.round((height * 161) / 44)
  return (
    <a
      href={MS_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Descargar OrdenSimple desde Microsoft Store"
      className={cn("inline-block rounded-md transition-opacity hover:opacity-90", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG oficial de Microsoft, sin optimizar */}
      <img src="/badges/microsoft-store-es.svg" alt="" width={width} height={height} className="dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG oficial de Microsoft, sin optimizar */}
      <img src="/badges/microsoft-store-es-light.svg" alt="" width={width} height={height} className="hidden dark:block" />
    </a>
  )
}
