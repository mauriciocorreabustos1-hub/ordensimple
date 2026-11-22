import { InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/landing/social-links"
import type { LinkSocialKind } from "@/lib/links"

// Íconos de las redes, dibujados en el propio código (no se descarga nada de otros sitios).

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13.5 21v-7.2h2.4l.4-2.8h-2.8V9.3c0-.8.2-1.4 1.4-1.4h1.5V5.4c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6V11H8.4v2.8h2.4V21z" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className} aria-hidden>
      <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 7v7h2.2v-7zm1.1-3.6a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM11 10v7h2.2v-3.7c0-1 .5-1.7 1.4-1.7.8 0 1.2.6 1.2 1.7V17H18v-4.3c0-2-1.1-2.9-2.6-2.9-1 0-1.7.5-2.1 1.1V10z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M4.5 4h4l11 16h-4z" strokeLinejoin="round" />
      <path d="M19.5 4l-6.6 7.3M4.5 20l6.6-7.3" />
    </svg>
  )
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className} aria-hidden>
      <path d="M6.5 5h11A4.5 4.5 0 0 1 22 9.5v5a4.5 4.5 0 0 1-4.5 4.5h-11A4.5 4.5 0 0 1 2 14.5v-5A4.5 4.5 0 0 1 6.5 5zM10 9v6l5.2-3z" />
    </svg>
  )
}

export function SocialIcon({ kind, className }: { kind: LinkSocialKind | "whatsapp"; className?: string }) {
  switch (kind) {
    case "instagram":
      return <InstagramIcon className={className} />
    case "tiktok":
      return <TikTokIcon className={className} />
    case "facebook":
      return <FacebookIcon className={className} />
    case "linkedin":
      return <LinkedInIcon className={className} />
    case "x":
      return <XIcon className={className} />
    case "youtube":
      return <YouTubeIcon className={className} />
    case "whatsapp":
      return <WhatsAppIcon className={className} />
  }
}
