import { cn } from "@/lib/utils"

/** Iniciales del negocio (ej. "Almacén Don Pedro" → "AD"), para cuando no hay logo. */
export function businessInitials(name: string) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "N"
}

/** Dirección del logo; cambia cuando se sube uno nuevo. */
export function businessLogoUrl(businessId: string, logoUpdatedAt: Date | string | null | undefined) {
  if (!logoUpdatedAt) return null
  return `/logo/${businessId}?v=${new Date(logoUpdatedAt).getTime()}`
}

/** Logo del negocio, o sus iniciales si todavía no sube uno. */
export function BusinessLogo({
  businessId,
  name,
  logoUpdatedAt,
  className,
}: {
  businessId: string
  name: string
  logoUpdatedAt: Date | string | null | undefined
  className?: string
}) {
  const url = businessLogoUrl(businessId, logoUpdatedAt)
  return url ? (
    // El logo ya viene achicado a 256 px: no hace falta optimizarlo de nuevo.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={`Logo de ${name}`} className={cn("size-8 shrink-0 rounded-lg bg-white object-contain", className)} />
  ) : (
    <span
      aria-hidden
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary", className)}
    >
      {businessInitials(name)}
    </span>
  )
}
