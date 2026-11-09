import Link from "next/link"
import { cn } from "@/lib/utils"

/** Isotipo: tres barras ordenadas que crecen y un punto que remata lo simple. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="64" height="64" rx="15" fill="var(--primary)" />
      <rect x="14" y="36" width="9" height="14" rx="4.5" fill="var(--primary-foreground)" />
      <rect x="27.5" y="28" width="9" height="22" rx="4.5" fill="var(--primary-foreground)" />
      <rect x="41" y="26" width="9" height="24" rx="4.5" fill="var(--primary-foreground)" />
      <circle cx="45.5" cy="17.5" r="4.5" fill="#f2a649" />
    </svg>
  )
}

export function Logo({ href = "/", className, onDark }: { href?: string; className?: string; /** Sobre fondo verde oscuro. */ onDark?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-lg">
        Orden<span className={onDark ? "text-[#7fd8b4]" : "text-primary"}>Simple</span>
      </span>
    </Link>
  )
}
