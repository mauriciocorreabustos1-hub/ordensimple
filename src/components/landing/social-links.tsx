import { cn } from "@/lib/utils"

export const SOCIAL_LINKS = [
  { name: "Instagram", handle: "@ordensimple.cl", href: "https://www.instagram.com/ordensimple.cl/" },
  { name: "TikTok", handle: "@ordensimple.cl", href: "https://www.tiktok.com/@ordensimple.cl" },
] as const

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Logo de TikTok (Simple Icons, licencia CC0).
export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}

/** Íconos de Instagram y TikTok (abren en otra pestaña). */
export function SocialLinks({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <div className={cn("flex items-center gap-2", size === "sm" && "gap-1", className)}>
      {SOCIAL_LINKS.map((s) => (
        <a
          key={s.name}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`OrdenSimple en ${s.name} (${s.handle})`}
          title={`${s.name} ${s.handle}`}
          className={cn(
            "flex items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary",
            size === "sm" ? "size-9" : "size-10",
          )}
        >
          {s.name === "Instagram" ? <InstagramIcon className="size-5" /> : <TikTokIcon className="size-[18px]" />}
        </a>
      ))}
    </div>
  )
}

/** Botones con nombre y usuario (@ordensimple.cl): más fáciles de ver y de tocar que los íconos solos. */
export function SocialButtons({ className, tone = "default" }: { className?: string; tone?: "default" | "sidebar" }) {
  return (
    <div className={cn("grid gap-2", className)}>
      {SOCIAL_LINKS.map((s) => (
        <a
          key={s.name}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Seguir a OrdenSimple en ${s.name} (${s.handle})`}
          className={cn(
            "group flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40",
            tone === "sidebar" && "border-transparent bg-transparent px-2 py-1.5 hover:bg-sidebar-accent",
          )}
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg text-white",
              s.name === "Instagram" ? "bg-[linear-gradient(135deg,#f58529,#dd2a7b_50%,#8134af)]" : "bg-[#111]",
              tone === "sidebar" && "size-7 rounded-md",
            )}
          >
            {s.name === "Instagram" ? <InstagramIcon className="size-[18px]" /> : <TikTokIcon className="size-4" />}
          </span>
          <span className="min-w-0 leading-tight">
            <span className={cn("block text-sm font-medium", tone === "sidebar" && "text-[13px]")}>{s.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{s.handle}</span>
          </span>
          {tone === "default" ? <span className="ml-auto text-xs font-medium text-primary group-hover:underline">Seguir</span> : null}
        </a>
      ))}
    </div>
  )
}
