import Image from "next/image"
import { Play } from "lucide-react"
import { Container } from "@/components/landing/sections"
import { SOCIAL_LINKS, SocialButtons } from "@/components/landing/social-links"
import { cn } from "@/lib/utils"

const TIKTOK = SOCIAL_LINKS.find((s) => s.name === "TikTok")!.href

// Portadas de videos reales de la cuenta (guardadas en /public/redes).
const VIDEOS = [
  { src: "/redes/fiado.jpg", title: "Cobra el fiado por WhatsApp" },
  { src: "/redes/cierre.jpg", title: "¿Te cuadra la caja?" },
  { src: "/redes/calculadoras.jpg", title: "¿A cuánto vender para ganar?" },
]

/** Invitación a seguir la cuenta: videos cortos con trucos para el negocio. */
export function SocialSection() {
  return (
    <section className="overflow-hidden border-t">
      <Container className="grid items-center gap-10 py-16 md:py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        <div className="space-y-5">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-[3.25rem] sm:leading-[1.04]">
            Trucos de 15 segundos para tu negocio
          </h2>
          <p className="max-w-md text-lg text-pretty text-muted-foreground">
            Cada semana subimos videos cortos: cómo cobrar el fiado, cuadrar la caja, a cuánto vender y más. Síguenos para no perderte ninguno.
          </p>
          <SocialButtons className="max-w-sm" />
        </div>
        <div className="flex justify-center gap-3 sm:gap-5 lg:justify-end">
          {VIDEOS.map((v, i) => (
            <a
              key={v.src}
              href={TIKTOK}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ver en TikTok: ${v.title}`}
              className={cn(
                "group relative aspect-[9/16] w-[31%] max-w-[190px] overflow-hidden rounded-2xl border-4 border-foreground/15 shadow-xl transition-transform hover:-translate-y-1",
                i === 1 ? "sm:-translate-y-4 sm:hover:-translate-y-5" : "sm:translate-y-3 sm:hover:translate-y-2",
              )}
            >
              <Image src={v.src} alt="" fill sizes="(min-width: 640px) 190px, 31vw" className="object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25">
                <span className="flex size-11 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
                  <Play className="ml-0.5 size-5 fill-current" />
                </span>
              </span>
            </a>
          ))}
        </div>
      </Container>
    </section>
  )
}
