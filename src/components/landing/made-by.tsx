import { cn } from "@/lib/utils"

export const ORFEX_URL = "https://www.orfex.cl"

/**
 * "Desarrollado por Orfex Group", con su logo y enlace. OrdenSimple es un producto de Orfex Group.
 * `onDark`: logo con letras blancas para fondos oscuros (pie de la web).
 */
export function MadeBy({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  return (
    <a
      href={`${ORFEX_URL}/?utm_source=ordensimple`}
      target="_blank"
      rel="noopener"
      className={cn(
        "inline-flex items-center gap-2.5 text-xs transition-opacity hover:opacity-80",
        onDark ? "text-deep-foreground/70" : "text-muted-foreground",
        className,
      )}
      aria-label="Desarrollado por Orfex Group (abre orfex.cl)"
    >
      <span>Desarrollado por</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG liviano propio, sin optimizar */}
      <img
        src={onDark ? "/brand/orfex/orfex-group-oscuro.svg" : "/brand/orfex/orfex-group.svg"}
        alt="Orfex Group"
        width={340}
        height={100}
        loading="lazy"
        decoding="async"
        className="h-7 w-auto"
      />
    </a>
  )
}
