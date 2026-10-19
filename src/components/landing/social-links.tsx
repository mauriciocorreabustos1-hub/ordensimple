import { WHATSAPP } from "@/lib/contact"
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

// Logo de WhatsApp (Simple Icons, licencia CC0).
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

/** Botón para escribirnos por WhatsApp (mismo estilo que los de Instagram y TikTok). */
export function WhatsAppButton({ className, text, tone = "default" }: { className?: string; text?: string; tone?: "default" | "sidebar" }) {
  return (
    <a
      href={WHATSAPP.link(text)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Escribir a OrdenSimple por WhatsApp (${WHATSAPP.display})`}
      className={cn(
        "group flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-left transition-colors hover:border-[#25d366]/60",
        tone === "sidebar" && "border-transparent bg-transparent px-2 py-1.5 hover:bg-sidebar-accent",
        className,
      )}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#25d366] text-white", tone === "sidebar" && "size-7 rounded-md")}>
        <WhatsAppIcon className={tone === "sidebar" ? "size-4" : "size-5"} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className={cn("block text-sm font-medium", tone === "sidebar" && "text-[13px]")}>{tone === "sidebar" ? "Ayuda por WhatsApp" : "WhatsApp"}</span>
        <span className="block truncate text-xs text-muted-foreground">{WHATSAPP.display}</span>
      </span>
      {tone === "default" ? <span className="ml-auto text-xs font-medium text-[#128c4a] group-hover:underline">Escribir</span> : null}
    </a>
  )
}
