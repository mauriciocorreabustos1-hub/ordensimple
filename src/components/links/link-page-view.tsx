import {
  CalendarDays,
  Camera,
  FileText,
  Gift,
  Globe,
  Heart,
  Link2,
  Mail,
  MapPin,
  Phone,
  Play,
  Scissors,
  ShoppingBag,
  Star,
  Tag,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react"
import type { CSSProperties, ReactNode } from "react"
import { LinkVideo } from "@/components/links/link-video"
import { SocialIcon } from "@/components/links/social-icons"
import { formatPhone, normalizePhone } from "@/lib/contact-card"
import {
  BLOCK_INFO,
  blockProblem,
  contrast,
  FONTS,
  isBlockLive,
  LINK_SOCIALS,
  mapsUrl,
  normalizeLinkSocial,
  parseVideo,
  readableOn,
  safeUrl,
  type LinkBlock,
  type LinkContent,
  type LinkIcon,
  type LinkTheme,
} from "@/lib/links"
import { whatsappLink } from "@/lib/whatsapp"
import { cn } from "@/lib/utils"

// La página de enlaces tal como la ve el público. No usa estado ni datos del servidor: la misma vista se dibuja
// en la página pública y en el celular de la vista previa del editor, así lo que se ve al editar es lo que se publica.

export type LinkProductCard = { id: string; name: string; price: string; imageUrl: string | null; href: string | null }

export type LinkViewData = {
  content: LinkContent
  logoUrl: string | null
  /** Productos de cada bloque "Productos", leídos en vivo del catálogo (solo nombre, foto, precio y enlace). */
  products: Record<string, LinkProductCard[]>
  /** Dónde se reserva (la tienda con la agenda), o null si el negocio no recibe reservas. */
  bookingUrl: string | null
  /** Hoy en la zona del negocio (AAAA-MM-DD), para las fechas de visibilidad. */
  today: string
  /** En el editor: muestra lo que falta completar y los bloques de ejemplo, en vez de esconderlos. */
  preview?: boolean
}

export const imageSrc = (id: string) => `/l/i/${id}`

const ICONS: Record<LinkIcon, LucideIcon> = {
  link: Link2,
  shop: ShoppingBag,
  calendar: CalendarDays,
  star: Star,
  gift: Gift,
  heart: Heart,
  mail: Mail,
  phone: Phone,
  map: MapPin,
  play: Play,
  file: FileText,
  camera: Camera,
  food: UtensilsCrossed,
  scissors: Scissors,
  tag: Tag,
  globe: Globe,
}
export const LINK_ICON_COMPONENTS = ICONS

const RADIUS = { none: "0px", sm: "6px", md: "14px", full: "999px" }
const CARD_RADIUS = { none: "0px", sm: "6px", md: "16px", full: "22px" }
const SIZE = { s: "15px", m: "16px", l: "18px" }
const GAP = { compact: "8px", normal: "12px", airy: "18px" }

/** Colores finales, con el contraste asegurado: si algo no se lee, pasa a negro o blanco. */
function palette(theme: LinkTheme) {
  const image = theme.bg.kind === "image" && theme.bg.image
  const bgColor = image ? (theme.bg.overlay === "dark" ? "#111111" : "#ffffff") : theme.bg.color
  const text = image ? (theme.bg.overlay === "dark" ? "#ffffff" : "#111111") : contrast(theme.text, bgColor) >= 3 ? theme.text : readableOn(bgColor)
  const accentText = contrast(theme.accentText, theme.accent) >= 3 ? theme.accentText : readableOn(theme.accent)
  // El borde y el texto de los botones de contorno usan el color principal solo si se distingue del fondo.
  const line = contrast(theme.accent, bgColor) >= 3 ? theme.accent : text
  const background = image
    ? `linear-gradient(${theme.bg.overlay === "dark" ? "rgb(0 0 0 / 0.62), rgb(0 0 0 / 0.78)" : "rgb(255 255 255 / 0.7), rgb(255 255 255 / 0.85)"}), url(${imageSrc(theme.bg.image!)}) center / cover`
    : theme.bg.kind === "gradient"
      ? `linear-gradient(${theme.bg.angle}deg, ${theme.bg.color}, ${theme.bg.color2})`
      : theme.bg.color
  return { background, bgColor, text, accentText, line }
}

export function linkPageStyle(theme: LinkTheme): CSSProperties {
  const p = palette(theme)
  return {
    "--lk-text": p.text,
    "--lk-sheet": p.bgColor,
    // Superficies (botones suaves, tarjetas): casi transparentes sobre un color; más sólidas sobre una foto, para que se lean.
    "--lk-soft": theme.bg.kind === "image" ? `color-mix(in oklab, ${p.bgColor} 62%, transparent)` : `color-mix(in oklab, ${p.text} 10%, transparent)`,
    "--lk-surface": theme.bg.kind === "image" ? `color-mix(in oklab, ${p.bgColor} 70%, transparent)` : `color-mix(in oklab, ${p.text} 6%, transparent)`,
    "--lk-accent": theme.accent,
    "--lk-accent-text": p.accentText,
    "--lk-line": p.line,
    "--lk-radius": RADIUS[theme.radius],
    "--lk-card-radius": CARD_RADIUS[theme.radius],
    "--lk-gap": GAP[theme.spacing],
    "--lk-shadow": theme.shadow ? "0 8px 22px -10px rgb(0 0 0 / 0.35)" : "none",
    background: p.background,
    color: p.text,
    fontFamily: FONTS[theme.font].css,
    fontSize: SIZE[theme.size],
  } as CSSProperties
}

/** Estilo de un botón según el diseño (relleno, contorno, suave o marcado) y si va destacado. */
function buttonClass(theme: LinkTheme, highlight?: boolean) {
  const style = highlight && (theme.button === "outline" || theme.button === "soft") ? "fill" : theme.button
  return cn(
    "lk-btn relative flex min-h-[3.25rem] w-full items-center gap-3 rounded-[var(--lk-radius)] px-4 py-3 text-[0.95em] font-semibold no-underline transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none [box-shadow:var(--lk-shadow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lk-text)]",
    style === "fill" && "bg-[var(--lk-accent)] text-[var(--lk-accent-text)] hover:brightness-[1.06]",
    style === "outline" && "border-2 border-[var(--lk-line)] text-[var(--lk-line)] hover:bg-[color-mix(in_oklab,var(--lk-line)_8%,transparent)]",
    style === "soft" && "bg-[var(--lk-soft)] text-[var(--lk-text)] hover:brightness-110",
    style === "hard" &&
      "w-[calc(100%-4px)] border-2 border-[var(--lk-text)] bg-[var(--lk-accent)] text-[var(--lk-accent-text)] [box-shadow:4px_4px_0_var(--lk-text)] hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:[box-shadow:1px_1px_0_var(--lk-text)]",
    theme.align === "center" ? "justify-center text-center" : "text-left",
  )
}

function external(href: string) {
  return /^https?:/.test(href) ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {}
}

function Btn({ block, theme, href, icon: Icon, children }: { block: LinkBlock; theme: LinkTheme; href: string; icon?: LucideIcon | null; children: ReactNode }) {
  const center = theme.align === "center"
  return (
    <a href={href} data-lk={block.id} className={buttonClass(theme, block.highlight)} {...external(href)}>
      {Icon ? <Icon aria-hidden className={cn("size-[1.15em] shrink-0", center && "absolute left-4")} /> : null}
      <span className={cn("min-w-0 text-balance", center ? "px-6" : "flex-1")}>{children}</span>
    </a>
  )
}

function BlockView({ block, data }: { block: LinkBlock; data: LinkViewData }) {
  const { theme } = data.content
  switch (block.type) {
    case "link": {
      const href = safeUrl(block.url) ?? "#"
      if (block.thumb) {
        return (
          <a href={href} data-lk={block.id} className={cn(buttonClass(theme, block.highlight), "py-2 pl-2", theme.align === "center" && "justify-start text-left")} {...external(href)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc(block.thumb)} alt="" className="size-11 shrink-0 rounded-[calc(var(--lk-radius)*0.7)] object-cover" />
            <span className="min-w-0 flex-1 text-balance">{block.title}</span>
          </a>
        )
      }
      return (
        <Btn block={block} theme={theme} href={href} icon={block.icon ? ICONS[block.icon] : null}>
          {block.title}
        </Btn>
      )
    }
    case "text":
      return (
        <div className={cn("space-y-1.5 py-1", theme.align === "center" ? "text-center" : "text-left")}>
          {block.title ? <h2 className="text-[1.2em] leading-snug font-bold text-balance">{block.title}</h2> : null}
          {block.body ? <p className="text-[0.95em] leading-relaxed whitespace-pre-line opacity-85">{block.body}</p> : null}
        </div>
      )
    case "image": {
      const img = block.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc(block.image)}
          alt={block.alt}
          loading="lazy"
          className={cn(
            "w-full rounded-[var(--lk-card-radius)] object-cover [box-shadow:var(--lk-shadow)]",
            block.ratio === "square" && "aspect-square",
            block.ratio === "wide" && "aspect-[16/9]",
          )}
        />
      ) : (
        <div className="grid aspect-[16/9] place-items-center rounded-[var(--lk-card-radius)] border-2 border-dashed border-current/25 text-sm opacity-60">Sube una foto</div>
      )
      const href = block.url ? safeUrl(block.url) : null
      return href ? (
        <a href={href} data-lk={block.id} className="block" {...external(href)}>
          {img}
        </a>
      ) : (
        img
      )
    }
    case "video": {
      const video = parseVideo(block.url)
      return video ? <LinkVideo id={block.id} video={video} title={block.title} /> : <Placeholder>Pega el enlace de un video</Placeholder>
    }
    case "socials": {
      const items = block.items.flatMap((s) => {
        const handle = normalizeLinkSocial(s.kind, s.handle)
        return handle ? [{ kind: s.kind, label: LINK_SOCIALS[s.kind].label, url: LINK_SOCIALS[s.kind].url(handle) }] : []
      })
      if (!items.length) return <Placeholder>Agrega tus redes</Placeholder>
      return (
        <ul className={cn("flex flex-wrap gap-2.5 py-1", theme.align === "center" ? "justify-center" : "justify-start")}>
          {items.map((s) => (
            <li key={s.kind}>
              <a
                href={s.url}
                data-lk={block.id}
                aria-label={s.label}
                title={s.label}
                className="grid size-11 place-items-center rounded-full bg-[var(--lk-soft)] transition-[filter] hover:brightness-110"
                {...external(s.url)}
              >
                <SocialIcon kind={s.kind} className="size-5" />
              </a>
            </li>
          ))}
        </ul>
      )
    }
    case "whatsapp":
      return (
        <Btn block={block} theme={theme} href={whatsappLink(normalizePhone(block.phone), block.message || undefined)}>
          <span className="inline-flex items-center gap-2">
            <SocialIcon kind="whatsapp" className="size-[1.1em] shrink-0" />
            {block.title || "WhatsApp"}
          </span>
        </Btn>
      )
    case "email": {
      const qs = block.subject ? `?subject=${encodeURIComponent(block.subject)}` : ""
      return (
        <Btn block={block} theme={theme} href={`mailto:${block.email}${qs}`} icon={Mail}>
          {block.title || block.email}
        </Btn>
      )
    }
    case "phone": {
      const phone = normalizePhone(block.phone)
      return (
        <Btn block={block} theme={theme} href={`tel:${phone ?? ""}`} icon={Phone}>
          {block.title || (phone ? formatPhone(phone) : "Llámanos")}
        </Btn>
      )
    }
    case "location":
      return (
        <a href={mapsUrl(block.address)} data-lk={block.id} {...external("https://")} className="lk-card flex items-start gap-3 rounded-[var(--lk-card-radius)] border border-current/15 bg-[var(--lk-surface)] p-4 text-left no-underline [box-shadow:var(--lk-shadow)] transition-colors hover:bg-[color-mix(in_oklab,var(--lk-text)_6%,transparent)]">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--lk-accent)] text-[var(--lk-accent-text)]">
            <MapPin aria-hidden className="size-5" />
          </span>
          <span className="min-w-0 space-y-0.5">
            <span className="block font-semibold">{block.title || "Cómo llegar"}</span>
            <span className="block text-[0.9em] opacity-80">{block.address}</span>
            <span className="block text-[0.8em] font-semibold underline underline-offset-2 opacity-90">Abrir en el mapa</span>
          </span>
        </a>
      )
    case "separator":
      if (block.style === "space") return <div aria-hidden className="h-4" />
      return block.style === "dots" ? (
        <div aria-hidden className="flex justify-center gap-2 py-2 opacity-50">
          <span className="size-1.5 rounded-full bg-current" />
          <span className="size-1.5 rounded-full bg-current" />
          <span className="size-1.5 rounded-full bg-current" />
        </div>
      ) : (
        <hr className="my-1 border-current/20" />
      )
    case "products": {
      const items = data.products[block.id] ?? []
      if (!items.length) return <Placeholder>Elige los productos que quieres mostrar</Placeholder>
      return (
        <section className="space-y-2.5">
          {block.title ? <h2 className={cn("text-[1.05em] font-bold", theme.align === "center" ? "text-center" : "text-left")}>{block.title}</h2> : null}
          <ul className={block.layout === "grid" ? "grid grid-cols-2 gap-2.5" : "grid gap-2"}>
            {items.map((p) => {
              const inner =
                block.layout === "grid" ? (
                  <>
                    <ProductPhoto product={p} className="aspect-square w-full" />
                    <span className="block px-3 pt-2 pb-3 text-left">
                      <span className="line-clamp-2 block text-[0.88em] leading-snug font-medium">{p.name}</span>
                      <span className="mt-0.5 block font-bold tabular-nums">{p.price}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <ProductPhoto product={p} className="size-14 shrink-0 rounded-[calc(var(--lk-card-radius)*0.6)]" />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="line-clamp-2 block text-[0.92em] leading-snug font-medium">{p.name}</span>
                      <span className="block font-bold tabular-nums">{p.price}</span>
                    </span>
                  </>
                )
              const cls = cn(
                "lk-card block overflow-hidden rounded-[var(--lk-card-radius)] bg-[var(--lk-surface)] no-underline [box-shadow:var(--lk-shadow)]",
                block.layout === "list" && "flex items-center gap-3 p-2 pr-4",
              )
              return (
                <li key={p.id}>
                  {p.href ? (
                    <a href={p.href} data-lk={block.id} className={cn(cls, "transition-transform hover:-translate-y-0.5 motion-reduce:transition-none")} {...external(p.href)}>
                      {inner}
                    </a>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )
    }
    case "booking":
      return data.bookingUrl ? (
        <Btn block={block} theme={theme} href={data.bookingUrl} icon={CalendarDays}>
          {block.title || "Reserva tu hora"}
        </Btn>
      ) : (
        <Placeholder>Las reservas se muestran cuando tu tienda online y la Agenda están activas</Placeholder>
      )
    case "quote": {
      const text = block.message || "Hola, me gustaría pedir una cotización."
      const href = block.channel === "whatsapp" ? whatsappLink(normalizePhone(block.phone), text) : `mailto:${block.email}?subject=${encodeURIComponent("Solicitud de cotización")}&body=${encodeURIComponent(text)}`
      return (
        <Btn block={block} theme={theme} href={href} icon={FileText}>
          {block.title || "Pide una cotización"}
        </Btn>
      )
    }
    case "promo": {
      const href = block.url ? safeUrl(block.url) : null
      const until = block.until ? new Date(`${block.until}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long" }) : null
      return (
        // El cupón: borde punteado, como un vale de papel.
        <div className="lk-card relative rounded-[var(--lk-card-radius)] border-2 border-dashed border-[var(--lk-line)] bg-[var(--lk-surface)] p-4 text-left [box-shadow:var(--lk-shadow)]">
          <p className="flex items-center gap-1.5 text-[0.78em] font-semibold opacity-80">
            <Tag aria-hidden className="size-3.5" />
            Promoción{until ? ` · hasta el ${until}` : ""}
          </p>
          <p className="mt-1 text-[1.15em] leading-snug font-bold text-balance">{block.title}</p>
          {block.body ? <p className="mt-1 text-[0.92em] whitespace-pre-line opacity-85">{block.body}</p> : null}
          {block.code || href ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {block.code ? (
                <span className="rounded-md border border-current/25 px-2.5 py-1 font-mono text-[0.9em] font-bold tracking-wider" title="Código del cupón">
                  {block.code}
                </span>
              ) : null}
              {href ? (
                <a href={href} data-lk={block.id} className="rounded-[var(--lk-radius)] bg-[var(--lk-accent)] px-3.5 py-1.5 text-[0.88em] font-semibold text-[var(--lk-accent-text)] no-underline" {...external(href)}>
                  Aprovechar
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      )
    }
  }
}

function ProductPhoto({ product, className }: { product: LinkProductCard; className?: string }) {
  return product.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={product.imageUrl} alt="" loading="lazy" className={cn("block object-cover", className)} />
  ) : (
    <span aria-hidden className={cn("grid place-items-center bg-[color-mix(in_oklab,var(--lk-text)_8%,transparent)] text-[1.4em] font-bold opacity-70", className)}>
      {product.name.trim()[0]?.toUpperCase()}
    </span>
  )
}

function Placeholder({ children }: { children: ReactNode }) {
  return <div className="rounded-[var(--lk-card-radius)] border-2 border-dashed border-current/25 px-4 py-5 text-center text-[0.85em] opacity-70">{children}</div>
}

function Header({ data }: { data: LinkViewData }) {
  const { profile, theme } = data.content
  const avatar = profile.avatar ? imageSrc(profile.avatar) : profile.useLogo ? data.logoUrl : null
  const left = theme.header === "left"
  const center = theme.align === "center" && !left
  const coverTall = theme.header === "cover"
  const initials = profile.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
  const phone = profile.phone ? normalizePhone(profile.phone) : null

  const avatarEl = (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--lk-accent)] font-bold text-[var(--lk-accent-text)] ring-4 ring-[color-mix(in_oklab,var(--lk-text)_8%,transparent)]",
        left ? "size-16 text-xl" : "size-24 text-3xl",
      )}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="size-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  )

  return (
    <header className={cn("space-y-3", center ? "text-center" : "text-left")}>
      {profile.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc(profile.cover)}
          alt=""
          className={cn(
            "-mx-5 w-[calc(100%+2.5rem)] max-w-none object-cover @3xl:-mx-10 @3xl:w-[calc(100%+5rem)]",
            coverTall ? "aspect-[16/9]" : "aspect-[3/1] rounded-b-[var(--lk-card-radius)]",
          )}
        />
      ) : null}
      <div className={cn(left ? "flex items-end gap-4" : "space-y-3", profile.cover && !left && "-mt-14")}>
        {/* Con portada, solo la foto de perfil se monta sobre ella; el nombre queda siempre sobre el fondo. */}
        <div className={cn(center && "flex justify-center", profile.cover && left && "-mt-10")}>{avatarEl}</div>
        <div className="min-w-0 space-y-0.5">
          <h1 className="text-[1.5em] leading-tight font-bold tracking-tight text-balance">{profile.name || "Tu nombre"}</h1>
          {profile.category || profile.location ? (
            <p className={cn("flex flex-wrap items-center gap-x-2 text-[0.85em] opacity-75", center && "justify-center")}>
              {profile.category ? <span>{profile.category}</span> : null}
              {profile.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden className="size-3.5" />
                  {profile.location}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      {profile.bio ? <p className={cn("text-[0.95em] leading-relaxed whitespace-pre-line opacity-90", center && "mx-auto max-w-[34ch]")}>{profile.bio}</p> : null}
      {profile.email || phone ? (
        <p className={cn("flex flex-wrap gap-2 text-[0.85em]", center && "justify-center")}>
          {phone ? (
            <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 rounded-full border border-current/20 px-3 py-1 no-underline">
              <Phone aria-hidden className="size-3.5" />
              {formatPhone(phone)}
            </a>
          ) : null}
          {profile.email ? (
            <a href={`mailto:${profile.email}`} className="inline-flex items-center gap-1.5 rounded-full border border-current/20 px-3 py-1 no-underline">
              <Mail aria-hidden className="size-3.5" />
              {profile.email}
            </a>
          ) : null}
        </p>
      ) : null}
    </header>
  )
}

export function LinkPageView({ data, className }: { data: LinkViewData; className?: string }) {
  const { content } = data
  const blocks = content.blocks.filter((b) => (data.preview ? !b.hidden : isBlockLive(b, data.today)))
  const photo = content.theme.bg.kind === "image" && Boolean(content.theme.bg.image)
  return (
    // En pantallas anchas (según el ancho de la página, no de la pantalla: la vista previa del editor sigue como celular)
    // el contenido va centrado sobre una lámina; con foto de fondo, una lámina de vidrio para que se lea sobre la foto.
    <div className={cn("@container flex min-h-full w-full flex-col", className)} style={linkPageStyle(content.theme)}>
      <div className="mx-auto flex w-full max-w-[34rem] flex-1 flex-col px-5 pt-0 pb-8 @3xl:max-w-[38rem] @3xl:justify-center @3xl:py-14">
        <div
          className={cn(
            "@3xl:overflow-hidden @3xl:rounded-[32px] @3xl:px-10 @3xl:pb-10",
            photo
              ? "@3xl:border @3xl:border-white/10 @3xl:bg-[color-mix(in_oklab,var(--lk-sheet)_58%,transparent)] @3xl:backdrop-blur-xl @3xl:[box-shadow:0_40px_90px_-40px_rgb(0_0_0/0.55)]"
              : "@3xl:border @3xl:border-current/10 @3xl:bg-[color-mix(in_oklab,var(--lk-text)_4%,transparent)] @3xl:[box-shadow:0_24px_60px_-36px_rgb(0_0_0/0.22)]",
          )}
        >
        <div className={cn(!content.profile.cover && "pt-10")}>
          <Header data={data} />
        </div>
        <main className="mt-7 flex flex-col" style={{ gap: "var(--lk-gap)" }}>
          {blocks.map((b) => {
            const problem = data.preview ? (b.demo ? "Ejemplo: cámbialo con tus datos" : blockProblem(b)) : null
            const scheduled = data.preview && ((b.startsAt && data.today < b.startsAt) || (b.endsAt && data.today > b.endsAt))
            return (
              <div key={b.id} data-block={b.id} className={cn("relative", data.preview && (problem || scheduled) && "opacity-55")}>
                <BlockView block={b} data={data} />
                {data.preview && (problem || scheduled) ? (
                  <span className="pointer-events-none absolute -top-2 right-2 rounded-full bg-[#111] px-2 py-0.5 font-sans text-[10px] font-medium text-white">
                    {scheduled ? "Fuera de sus fechas" : b.demo ? "Ejemplo" : `${BLOCK_INFO[b.type].label}: falta completar`}
                  </span>
                ) : null}
              </div>
            )
          })}
        </main>
        </div>
        {content.branding ? (
          <p className="mt-auto pt-10 text-center text-[12px] opacity-70 @3xl:mt-0 @3xl:pt-6">
            <a href="https://www.ordensimple.cl/?utm_source=links" target="_blank" rel="noopener" className="font-sans font-medium underline-offset-2 hover:underline">
              Hecho con OrdenSimple
            </a>
          </p>
        ) : null}
      </div>
    </div>
  )
}
