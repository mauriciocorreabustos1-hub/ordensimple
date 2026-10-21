import { cn } from "@/lib/utils"

const TONES = ["bg-emerald-100 text-emerald-800", "bg-sky-100 text-sky-800", "bg-amber-100 text-amber-800", "bg-violet-100 text-violet-800", "bg-rose-100 text-rose-800", "bg-teal-100 text-teal-800"]

/** Foto del producto, o su inicial sobre un color (siempre el mismo para el mismo nombre) si todavía no tiene. */
export function ProductImage({ name, url, className, sizes = "small" }: { name: string; url: string | null; className?: string; sizes?: "small" | "large" }) {
  if (url) {
    return (
      // Las fotos ya vienen achicadas (máximo 800 px) y servidas por la red de Vercel: no hace falta optimizarlas otra vez.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} loading="lazy" decoding="async" className={cn("rounded-lg bg-muted object-cover", className)} />
    )
  }
  const tone = TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length]
  return (
    <span aria-hidden className={cn("flex items-center justify-center rounded-lg font-semibold", sizes === "large" ? "text-3xl" : "text-sm", tone, className)}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  )
}
