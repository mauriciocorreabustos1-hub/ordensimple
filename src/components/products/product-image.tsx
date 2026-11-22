import { cn } from "@/lib/utils"

/** Foto del producto, o su inicial en el verde de la marca si todavía no tiene. */
export function ProductImage({ name, url, className, sizes = "small" }: { name: string; url: string | null; className?: string; sizes?: "small" | "large" }) {
  if (url) {
    return (
      // Las fotos ya vienen achicadas (máximo 800 px) y servidas por la red de Vercel: no hace falta optimizarlas otra vez.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} loading="lazy" decoding="async" className={cn("rounded-lg bg-muted object-cover", className)} />
    )
  }
  return (
    <span aria-hidden className={cn("flex items-center justify-center rounded-lg font-semibold", sizes === "large" ? "text-3xl" : "text-sm", "bg-primary/[0.08] text-primary", className)}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  )
}
