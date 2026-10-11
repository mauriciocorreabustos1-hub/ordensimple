import { cn } from "@/lib/utils"

/**
 * Cartel de precio como los de un almacén (forma de etiqueta con su hoyito), en el verde de la marca.
 * Es el elemento memorable de la portada: se usa una sola vez por página.
 */
export function PriceTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex items-baseline gap-2 rounded-r-lg bg-primary py-2.5 pr-5 pl-9 text-primary-foreground shadow-lg shadow-primary/25",
        "[clip-path:polygon(18px_0,100%_0,100%_100%,18px_100%,0_50%)]",
        className,
      )}
    >
      <span aria-hidden className="absolute top-1/2 left-4 size-2.5 -translate-y-1/2 rounded-full bg-background" />
      {children}
    </span>
  )
}
