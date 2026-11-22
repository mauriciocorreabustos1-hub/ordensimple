import { z } from "zod"
import { normalizePhone, normalizeSocial, normalizeWebsite, SOCIALS, type SocialKind } from "@/lib/contact-card"

// OrdenSimple Links: qué tiene una página de enlaces (perfil, diseño y bloques), cómo se valida y qué es Pro.
// Sin dependencias del servidor: lo usan el editor, la página pública, las acciones y las pruebas.

// ─── Dirección ──────────────────────────────────────────────────────────────

export const linkPath = (slug: string) => `/l/${slug}`

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/

/**
 * Nombres que no se pueden usar: rutas del sitio, palabras que harían pasar la página por oficial de OrdenSimple
 * y marcas e instituciones que se usan para engañar (bancos, pagos, redes, gobierno).
 */
const RESERVED = new Set([
  "admin", "api", "app", "ayuda", "blog", "contacto", "dashboard", "i", "l", "links", "login", "registro", "soporte", "support",
  "help", "oficial", "official", "verificado", "verified", "seguridad", "security", "cuenta", "account", "pago", "pagos", "pagar",
  "precios", "planes", "tienda", "perfil", "www", "mail", "correo", "static", "assets", "favicon", "robots", "sitemap",
  "bancoestado", "bancochile", "bancodechile", "santander", "bci", "scotiabank", "itau", "falabella", "bancofalabella", "ripley",
  "mercadopago", "mercadolibre", "webpay", "transbank", "khipu", "flow", "paypal", "google", "apple", "microsoft", "facebook",
  "instagram", "whatsapp", "tiktok", "youtube", "meta", "sii", "gob", "gobierno", "carabineros", "pdi", "registrocivil", "fonasa",
  "isapre", "afp", "chileatiende", "correoschile",
])

export const SLUG_HINT = "De 3 a 30 letras minúsculas, números o guiones (sin tildes ni espacios)."

export function slugProblem(slug: string): string | null {
  if (!SLUG_RE.test(slug) || slug.includes("--")) return SLUG_HINT
  if (RESERVED.has(slug) || slug.includes("ordensimple") || slug.replaceAll("-", "").includes("ordensimple")) return "Ese nombre está reservado. Prueba con otro."
  return null
}
export const isValidLinkSlug = (slug: string) => slugProblem(slug) === null

/** Propone un nombre de usuario a partir del nombre del negocio: "Café Central" da "cafecentral". */
export function suggestSlug(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30)
  return base.length >= 3 ? base : `${base}negocio`.slice(0, 30)
}

// ─── Enlaces seguros ────────────────────────────────────────────────────────

const IP_HOST = /^(\d{1,3}\.){3}\d{1,3}$|^\[|:/
const LOCAL_HOST = /(^|\.)(localhost|local|internal|home|lan)$/i

/**
 * Enlace externo: solo http o https, sin usuario ni clave escondidos (un truco de phishing), sin direcciones IP
 * ni equipos de la red local. Sin protocolo se asume https. Si no sirve, null.
 */
export function safeUrl(raw: string): string | null {
  const url = normalizeWebsite(raw)
  if (!url) return null
  const host = new URL(url).hostname
  if (IP_HOST.test(host) || LOCAL_HOST.test(host) || host.includes("..") || !/\.[a-z]{2,}$/i.test(host)) return null
  return url.length <= 500 ? url : null
}

/** Video de YouTube o Vimeo: se guarda solo el proveedor y el identificador (nunca se incrusta otra cosa). */
export function parseVideo(raw: string): { provider: "youtube" | "vimeo"; id: string } | null {
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "")
  const yt = /^[A-Za-z0-9_-]{11}$/
  if (host === "youtu.be") {
    const id = url.pathname.slice(1)
    return yt.test(id) ? { provider: "youtube", id } : null
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v")
    if (v && yt.test(v)) return { provider: "youtube", id: v }
    const m = /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/.exec(url.pathname)
    return m ? { provider: "youtube", id: m[1] } : null
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = /\/(?:video\/)?(\d{5,12})(?:\/|$)/.exec(url.pathname)
    return m ? { provider: "vimeo", id: m[1] } : null
  }
  return null
}

export const videoEmbedUrl = (v: { provider: "youtube" | "vimeo"; id: string }) =>
  v.provider === "youtube" ? `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0` : `https://player.vimeo.com/video/${v.id}?autoplay=1&dnt=1`

/** Búsqueda de la dirección en Google Maps (abre la app de mapas en el celular). */
export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

// ─── Redes sociales ─────────────────────────────────────────────────────────

export const LINK_SOCIALS = {
  ...SOCIALS,
  youtube: { label: "YouTube", hosts: ["youtube.com"], url: (h: string) => `https://www.youtube.com/@${h}` },
} as const
export type LinkSocialKind = keyof typeof LINK_SOCIALS
export const LINK_SOCIAL_KINDS = Object.keys(LINK_SOCIALS) as LinkSocialKind[]

export function normalizeLinkSocial(kind: LinkSocialKind, raw: string): string | null {
  if (kind !== "youtube") return normalizeSocial(kind as SocialKind, raw)
  const value = raw.trim().replace(/^@/, "")
  let handle = value
  if (/^https?:\/\//i.test(value) || value.includes("/")) {
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
      if (url.hostname.replace(/^(www|m)\./, "") !== "youtube.com") return null
      handle = url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "") ?? ""
    } catch {
      return null
    }
  }
  return /^[A-Za-z0-9._-]{1,80}$/.test(handle) ? handle : null
}

// ─── Diseño ─────────────────────────────────────────────────────────────────

const HEX = /^#[0-9a-f]{6}$/i
const hex = z.string().regex(HEX, "Color inválido").transform((v) => v.toLowerCase())
const imageId = z.string().regex(/^[a-z0-9]{20,40}$/)

export const FONTS = {
  geist: { label: "Moderna", css: "var(--font-geist-sans), system-ui, sans-serif", pro: false },
  bricolage: { label: "Con carácter", css: "var(--font-bricolage), var(--font-geist-sans), sans-serif", pro: false },
  serif: { label: "Clásica", css: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif", pro: true },
  rounded: { label: "Redondeada", css: "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', 'Arial Rounded MT Bold', system-ui, sans-serif", pro: true },
  mono: { label: "Máquina de escribir", css: "var(--font-geist-mono), ui-monospace, 'Cascadia Mono', Menlo, monospace", pro: true },
} as const
export type FontKey = keyof typeof FONTS

export const themeSchema = z.object({
  template: z.string().max(30),
  bg: z.object({
    kind: z.enum(["solid", "gradient", "image"]),
    color: hex,
    color2: hex,
    angle: z.number().int().min(0).max(360),
    image: imageId.nullable(),
    /** Velo sobre la foto de fondo para que el texto se lea: oscuro o claro. */
    overlay: z.enum(["dark", "light"]),
  }),
  text: hex,
  accent: hex,
  accentText: hex,
  font: z.enum(Object.keys(FONTS) as [FontKey, ...FontKey[]]),
  size: z.enum(["s", "m", "l"]),
  button: z.enum(["fill", "outline", "soft", "hard"]),
  radius: z.enum(["none", "sm", "md", "full"]),
  shadow: z.boolean(),
  spacing: z.enum(["compact", "normal", "airy"]),
  align: z.enum(["center", "left"]),
  header: z.enum(["classic", "cover", "left"]),
})
export type LinkTheme = z.infer<typeof themeSchema>

// ─── Bloques ────────────────────────────────────────────────────────────────

export const LINK_ICONS = ["link", "shop", "calendar", "star", "gift", "heart", "mail", "phone", "map", "play", "file", "camera", "food", "scissors", "tag", "globe"] as const
export type LinkIcon = (typeof LINK_ICONS)[number]

const t = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`)
const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .transform((v) => v ?? null)

const base = {
  id: z.string().regex(/^[a-z0-9]{6,16}$/),
  hidden: z.boolean().default(false),
  /** Se muestra desde / hasta (fechas en la zona del negocio). */
  startsAt: dateKey,
  endsAt: dateKey,
  /** Bloque de ejemplo de una plantilla: hay que cambiarlo o borrarlo antes de publicar. */
  demo: z.boolean().optional(),
  /** Botón destacado: con el color principal aunque los demás vayan más sobrios. */
  highlight: z.boolean().optional(),
}

// Los campos llegan "a medio escribir" mientras se edita: el borrador acepta vacíos y la publicación exige lo necesario.
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("link"), title: t(80), url: t(500), icon: z.enum(LINK_ICONS).nullable().default(null), thumb: imageId.nullable().default(null) }),
  z.object({ ...base, type: z.literal("text"), title: t(120), body: t(1200) }),
  z.object({ ...base, type: z.literal("image"), image: imageId.nullable(), alt: t(140), url: t(500), ratio: z.enum(["auto", "square", "wide"]) }),
  z.object({ ...base, type: z.literal("video"), url: t(300), title: t(80) }),
  z.object({ ...base, type: z.literal("socials"), items: z.array(z.object({ kind: z.enum(LINK_SOCIAL_KINDS as [LinkSocialKind, ...LinkSocialKind[]]), handle: t(200) })).max(12) }),
  z.object({ ...base, type: z.literal("whatsapp"), title: t(80), phone: t(30), message: t(300) }),
  z.object({ ...base, type: z.literal("email"), title: t(80), email: t(120), subject: t(120) }),
  z.object({ ...base, type: z.literal("phone"), title: t(80), phone: t(30) }),
  z.object({ ...base, type: z.literal("location"), title: t(80), address: t(200) }),
  z.object({ ...base, type: z.literal("separator"), style: z.enum(["line", "dots", "space"]) }),
  z.object({ ...base, type: z.literal("products"), title: t(80), productIds: z.array(z.string().regex(/^[\w-]{8,40}$/)).max(12), layout: z.enum(["grid", "list"]) }),
  z.object({ ...base, type: z.literal("booking"), title: t(80) }),
  z.object({ ...base, type: z.literal("quote"), title: t(80), channel: z.enum(["whatsapp", "email"]), phone: t(30), email: t(120), message: t(300) }),
  z.object({ ...base, type: z.literal("promo"), title: t(80), body: t(300), code: t(30), url: t(500), until: dateKey }),
])
export type LinkBlock = z.infer<typeof blockSchema>
export type LinkBlockType = LinkBlock["type"]

export const BLOCK_INFO: Record<LinkBlockType, { label: string; hint: string; pro: boolean }> = {
  link: { label: "Enlace", hint: "Un botón que lleva a cualquier página", pro: false },
  text: { label: "Texto", hint: "Un título o un párrafo", pro: false },
  image: { label: "Imagen", hint: "Una foto o un banner", pro: false },
  socials: { label: "Redes sociales", hint: "Íconos de Instagram, TikTok y otras", pro: false },
  whatsapp: { label: "WhatsApp", hint: "Te escriben con un mensaje listo", pro: false },
  email: { label: "Correo", hint: "Te escriben un correo", pro: false },
  phone: { label: "Teléfono", hint: "Te llaman con un toque", pro: false },
  location: { label: "Ubicación", hint: "Tu dirección con el mapa", pro: false },
  separator: { label: "Separador", hint: "Espacio o línea entre secciones", pro: false },
  video: { label: "Video", hint: "Un video de YouTube o Vimeo", pro: true },
  products: { label: "Productos", hint: "Tus productos con foto y precio, siempre al día", pro: true },
  booking: { label: "Reservas", hint: "Reservan hora en tu agenda", pro: true },
  quote: { label: "Cotización", hint: "Te piden una cotización", pro: true },
  promo: { label: "Promoción", hint: "Una oferta destacada, con cupón si quieres", pro: true },
}

export const MAX_BLOCKS = 60
export const FREE_MAX_BLOCKS = 12

// ─── Contenido completo ─────────────────────────────────────────────────────

export const contentSchema = z.object({
  v: z.literal(1),
  profile: z.object({
    name: t(80),
    bio: t(300),
    category: t(60),
    location: t(80),
    email: t(120),
    phone: t(30),
    /** Foto propia; si no hay, se usa el logo del negocio (si `useLogo`). */
    avatar: imageId.nullable(),
    useLogo: z.boolean(),
    cover: imageId.nullable(),
  }),
  theme: themeSchema,
  blocks: z.array(blockSchema).max(MAX_BLOCKS, `Máximo ${MAX_BLOCKS} bloques`),
  seo: z.object({ title: t(70), description: t(160) }),
  /** "Hecho con OrdenSimple" al pie (en Pro se puede quitar). */
  branding: z.boolean(),
})
export type LinkContent = z.infer<typeof contentSchema>

/** Ids de todas las fotos que usa el contenido (para no borrar ninguna en uso). */
export function contentImages(c: LinkContent) {
  const ids = [c.profile.avatar, c.profile.cover, c.theme.bg.image]
  for (const b of c.blocks) {
    if (b.type === "image") ids.push(b.image)
    if (b.type === "link") ids.push(b.thumb)
  }
  return ids.filter((id): id is string => Boolean(id))
}

export const newBlockId = () => Math.random().toString(36).slice(2, 10).padEnd(8, "0")

// ─── Lo que es Pro ──────────────────────────────────────────────────────────

/** Lo del contenido que solo se puede publicar con Pro (vacío = todo se puede en Gratis). */
export function proFeaturesUsed(c: LinkContent): string[] {
  const used = new Set<string>()
  const tpl = TEMPLATES.find((x) => x.id === c.theme.template)
  if (tpl?.pro) used.add(`la plantilla ${tpl.name}`)
  if (c.theme.bg.kind !== "solid") used.add(c.theme.bg.kind === "gradient" ? "el fondo degradado" : "la foto de fondo")
  if (FONTS[c.theme.font].pro) used.add(`la letra ${FONTS[c.theme.font].label}`)
  if (c.theme.shadow) used.add("las sombras")
  if (c.theme.spacing !== "normal" || c.theme.size !== "m") used.add("el tamaño y la separación")
  if (!c.branding) used.add("quitar “Hecho con OrdenSimple”")
  for (const b of c.blocks) if (BLOCK_INFO[b.type].pro && !b.hidden) used.add(`el bloque ${BLOCK_INFO[b.type].label}`)
  if (c.blocks.filter((b) => !b.hidden).length > FREE_MAX_BLOCKS) used.add(`más de ${FREE_MAX_BLOCKS} bloques visibles`)
  return [...used]
}

/**
 * Versión Gratis del contenido: lo Pro se apaga o vuelve a lo básico. Se aplica al mostrar la página, así un
 * negocio cuyo plan Pro venció nunca muestra funciones Pro aunque las haya publicado antes.
 */
export function toFreeContent(c: LinkContent): LinkContent {
  const tpl = TEMPLATES.find((x) => x.id === c.theme.template)
  const theme: LinkTheme = {
    ...c.theme,
    template: tpl?.pro ? "propia" : c.theme.template,
    bg: { ...c.theme.bg, kind: "solid" },
    font: FONTS[c.theme.font].pro ? "geist" : c.theme.font,
    shadow: false,
    spacing: "normal",
    size: "m",
  }
  const blocks = c.blocks.filter((b) => !BLOCK_INFO[b.type].pro && !b.hidden).slice(0, FREE_MAX_BLOCKS)
  return { ...c, theme, blocks, branding: true }
}

// ─── Lo que falta antes de publicar ─────────────────────────────────────────

/** Problemas que impiden publicar, en palabras simples (vacío = se puede publicar). */
export function publishProblems(c: LinkContent): string[] {
  const out: string[] = []
  if (c.profile.name.trim().length < 2) out.push("Escribe el nombre que se verá arriba (Perfil).")
  if (c.profile.email && !z.email().safeParse(c.profile.email).success) out.push("El correo del perfil no es válido.")
  if (c.profile.phone && !normalizePhone(c.profile.phone)) out.push("El teléfono del perfil no es válido.")
  const visible = c.blocks.filter((b) => !b.hidden)
  if (!visible.length) out.push("Agrega al menos un bloque.")
  for (const [i, b] of c.blocks.entries()) {
    if (b.hidden) continue
    const name = `Bloque ${i + 1} (${BLOCK_INFO[b.type].label})`
    if (b.demo) out.push(`${name}: es de ejemplo. Cámbialo con tus datos o bórralo.`)
    const p = blockProblem(b)
    if (p) out.push(`${name}: ${p}`)
  }
  return out
}

/** Qué le falta a un bloque para mostrarse (null = está listo). */
export function blockProblem(b: LinkBlock): string | null {
  switch (b.type) {
    case "link":
      if (!b.title) return "escribe el texto del botón."
      return safeUrl(b.url) ? null : "el enlace no es válido (usa una dirección que empiece con https://)."
    case "text":
      return b.title || b.body ? null : "escribe un título o un texto."
    case "image":
      if (!b.image) return "sube una foto."
      return !b.url || safeUrl(b.url) ? null : "el enlace de la imagen no es válido."
    case "video":
      return parseVideo(b.url) ? null : "pega el enlace de un video de YouTube o Vimeo."
    case "socials":
      if (!b.items.length) return "agrega al menos una red."
      return b.items.every((s) => normalizeLinkSocial(s.kind, s.handle)) ? null : "revisa los usuarios de tus redes."
    case "whatsapp":
      return normalizePhone(b.phone) ? null : "escribe un número de WhatsApp válido."
    case "email":
      return z.email().safeParse(b.email).success ? null : "escribe un correo válido."
    case "phone":
      return normalizePhone(b.phone) ? null : "escribe un teléfono válido."
    case "location":
      return b.address.length >= 4 ? null : "escribe la dirección."
    case "separator":
    case "booking":
      return null
    case "products":
      return b.productIds.length ? null : "elige al menos un producto."
    case "quote":
      if (b.channel === "whatsapp") return normalizePhone(b.phone) ? null : "escribe el WhatsApp donde recibes las cotizaciones."
      return z.email().safeParse(b.email).success ? null : "escribe el correo donde recibes las cotizaciones."
    case "promo":
      if (!b.title) return "escribe el título de la promoción."
      return !b.url || safeUrl(b.url) ? null : "el enlace de la promoción no es válido."
  }
}

/** ¿Se muestra hoy? Oculto, sin terminar o fuera de sus fechas: no. */
export function isBlockLive(b: LinkBlock, today: string) {
  if (b.hidden || b.demo || blockProblem(b)) return false
  if (b.startsAt && today < b.startsAt) return false
  if (b.endsAt && today > b.endsAt) return false
  if (b.type === "promo" && b.until && today > b.until) return false
  return true
}

// ─── Contraste (WCAG) ───────────────────────────────────────────────────────

function luminance(color: string) {
  const n = parseInt(color.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contraste entre dos colores, de 1 (nada) a 21 (negro sobre blanco). Para leer bien: 4,5 o más. */
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** Negro o blanco: el que mejor se lea sobre ese color. */
export const readableOn = (color: string) => (contrast(color, "#111111") >= contrast(color, "#ffffff") ? "#111111" : "#ffffff")

/** Problemas de lectura del diseño (vacío = se lee bien). Con foto de fondo, el velo asegura el contraste. */
export function contrastIssues(theme: LinkTheme) {
  const out: { key: "text" | "button"; message: string }[] = []
  if (theme.bg.kind !== "image") {
    const worst = Math.min(contrast(theme.text, theme.bg.color), theme.bg.kind === "gradient" ? contrast(theme.text, theme.bg.color2) : 21)
    if (worst < 4.5) out.push({ key: "text", message: "El texto se lee poco sobre el fondo." })
  }
  if (theme.button !== "outline" && contrast(theme.accentText, theme.accent) < 4.5) out.push({ key: "button", message: "El texto de los botones se lee poco." })
  return out
}

/** Arregla el contraste eligiendo negro o blanco donde haga falta. */
export function fixContrast(theme: LinkTheme): LinkTheme {
  const next = { ...theme }
  if (theme.bg.kind !== "image" && contrastIssues(theme).some((i) => i.key === "text")) next.text = readableOn(theme.bg.color)
  if (contrast(theme.accentText, theme.accent) < 4.5) next.accentText = readableOn(theme.accent)
  return next
}

// ─── Plantillas ─────────────────────────────────────────────────────────────

type Template = { id: string; name: string; for: string; pro: boolean; theme: Omit<LinkTheme, "template"> }

const solid = (color: string) => ({ kind: "solid" as const, color, color2: color, angle: 160, image: null, overlay: "dark" as const })
const gradient = (color: string, color2: string, angle = 160) => ({ kind: "gradient" as const, color, color2, angle, image: null, overlay: "dark" as const })
const std = { size: "m", spacing: "normal", shadow: false } as const

export const TEMPLATES: Template[] = [
  {
    id: "emprendedor",
    name: "Emprendedor",
    for: "Para quien vende por redes",
    pro: false,
    theme: { ...std, bg: solid("#ffffff"), text: "#10261c", accent: "#34d27b", accentText: "#0b2015", font: "bricolage", button: "fill", radius: "md", align: "center", header: "classic" },
  },
  {
    id: "minimarket",
    name: "Minimarket",
    for: "Almacenes y botillerías",
    pro: false,
    theme: { ...std, bg: solid("#ffe14d"), text: "#111111", accent: "#111111", accentText: "#ffe14d", font: "geist", button: "hard", radius: "sm", align: "center", header: "classic" },
  },
  {
    id: "servicios",
    name: "Servicios",
    for: "Técnicos, talleres y oficios",
    pro: false,
    theme: { ...std, bg: solid("#eef2f6"), text: "#14243a", accent: "#14243a", accentText: "#ffffff", font: "geist", button: "outline", radius: "md", align: "left", header: "left" },
  },
  {
    id: "marca",
    name: "Marca personal",
    for: "Creadores y profesionales",
    pro: false,
    theme: { ...std, bg: solid("#1b1b1f"), text: "#f4f4f5", accent: "#f4f4f5", accentText: "#1b1b1f", font: "bricolage", button: "soft", radius: "full", align: "center", header: "classic" },
  },
  {
    id: "restaurante",
    name: "Restaurante",
    for: "Restaurantes y cafeterías",
    pro: true,
    theme: { ...std, bg: solid("#6e1f24"), text: "#fbf1e4", accent: "#fbf1e4", accentText: "#6e1f24", font: "serif", button: "fill", radius: "none", align: "center", header: "cover" },
  },
  {
    id: "ropa",
    name: "Tienda de ropa",
    for: "Moda y accesorios",
    pro: true,
    theme: { ...std, bg: gradient("#ffd6e0", "#ffe9c7"), text: "#2a1a22", accent: "#2a1a22", accentText: "#ffffff", font: "rounded", button: "fill", radius: "full", align: "center", header: "classic", shadow: true },
  },
  {
    id: "belleza",
    name: "Belleza y estética",
    for: "Peluquerías, uñas y spa",
    pro: true,
    theme: { ...std, bg: gradient("#efe4fb", "#fdf3f8", 200), text: "#3b1f4a", accent: "#3b1f4a", accentText: "#ffffff", font: "serif", button: "outline", radius: "full", align: "center", header: "classic", spacing: "airy" },
  },
  {
    id: "corporativo",
    name: "Empresa",
    for: "Empresas y consultoras",
    pro: true,
    theme: { ...std, bg: solid("#ffffff"), text: "#0d1b2e", accent: "#0d3b66", accentText: "#ffffff", font: "geist", button: "fill", radius: "sm", align: "left", header: "cover", spacing: "compact" },
  },
  {
    id: "ecommerce",
    name: "Comercio online",
    for: "Tiendas con despacho",
    pro: true,
    theme: { ...std, bg: gradient("#0f3d2e", "#0a2a20", 180), text: "#ecfbf2", accent: "#34d27b", accentText: "#0b2015", font: "bricolage", button: "fill", radius: "md", align: "center", header: "cover", shadow: true },
  },
  {
    id: "portafolio",
    name: "Portafolio",
    for: "Diseño, fotografía y arte",
    pro: true,
    theme: { ...std, bg: solid("#f3f2ec"), text: "#1d1d1b", accent: "#1d1d1b", accentText: "#f3f2ec", font: "mono", button: "outline", radius: "none", align: "left", header: "left" },
  },
]

export const templateTheme = (id: string): LinkTheme => {
  const tpl = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0]
  return { template: tpl.id, ...tpl.theme }
}

/** Bloques sugeridos de cada rubro: van marcados como ejemplo hasta que se cambien. */
export function suggestedBlocks(templateId: string): LinkBlock[] {
  const d = { hidden: false, startsAt: null, endsAt: null, demo: true } as const
  const link = (title: string, icon: LinkIcon): LinkBlock => ({ ...d, id: newBlockId(), type: "link", title, url: "", icon, thumb: null })
  const byTemplate: Record<string, LinkBlock[]> = {
    restaurante: [link("Nuestra carta", "food"), link("Reserva tu mesa", "calendar"), { ...d, id: newBlockId(), type: "location", title: "Cómo llegar", address: "" }],
    belleza: [link("Nuestros servicios y precios", "scissors"), link("Trabajos recientes", "camera")],
    ropa: [link("Nueva colección", "tag"), link("Guía de tallas", "file")],
    minimarket: [link("Ofertas de la semana", "tag"), link("Pide a domicilio", "shop")],
    corporativo: [link("Quiénes somos", "globe"), link("Nuestros servicios", "file")],
    portafolio: [link("Mi trabajo", "camera"), link("Currículum", "file")],
  }
  return [
    { ...d, id: newBlockId(), type: "text", title: "Hola, somos…", body: "Cuenta en una o dos frases qué haces y para quién." },
    ...(byTemplate[templateId] ?? [link("Mi tienda", "shop"), link("Mis trabajos", "star")]),
    { ...d, id: newBlockId(), type: "socials", items: [] },
  ]
}

/** Página nueva con los datos reales del negocio: nombre, logo y, si existen, su WhatsApp, tienda y reservas. */
export function initialContent(d: { name: string; whatsapp: string | null; storeUrl: string | null; canBook: boolean }): LinkContent {
  const blocks: LinkBlock[] = []
  const common = { hidden: false, startsAt: null, endsAt: null } as const
  if (d.canBook) blocks.push({ ...common, id: newBlockId(), type: "booking", title: "Reserva tu hora" })
  if (d.storeUrl) blocks.push({ ...common, id: newBlockId(), type: "link", title: "Mira nuestra tienda", url: d.storeUrl, icon: "shop", thumb: null })
  if (d.whatsapp) blocks.push({ ...common, id: newBlockId(), type: "whatsapp", title: "Escríbenos por WhatsApp", phone: d.whatsapp, message: "Hola, vi su página y quería consultar…" })
  return {
    v: 1,
    profile: { name: d.name, bio: "", category: "", location: "", email: "", phone: "", avatar: null, useLogo: true, cover: null },
    theme: templateTheme("emprendedor"),
    blocks,
    seo: { title: "", description: "" },
    branding: true,
  }
}

/** Lee un contenido guardado; si está dañado o es de otra versión, null. */
export function readContent(json: unknown): LinkContent | null {
  const r = contentSchema.safeParse(json)
  return r.success ? r.data : null
}

// ─── Estadísticas ───────────────────────────────────────────────────────────

const SOURCES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "x"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)(bing\.com|duckduckgo\.com|search\.yahoo\.com)$/, "buscador"],
]

export const SOURCE_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  x: "X",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  google: "Google",
  buscador: "Otros buscadores",
  qr: "Código QR",
  directo: "Directo o desconocido",
  otro: "Otros sitios",
}

/** De dónde llegó la visita: ?src=qr del código QR, ?utm_source=…, o el sitio anterior. */
export function detectSource(referrer: string | null | undefined, search: string | null | undefined) {
  const params = new URLSearchParams(search ?? "")
  const tag = (params.get("src") ?? params.get("utm_source") ?? "").toLowerCase().replace(/[^a-z]/g, "")
  if (tag && tag in SOURCE_LABEL) return tag
  if (tag === "ig") return "instagram"
  if (tag === "fb") return "facebook"
  if (!referrer) return "directo"
  try {
    const host = new URL(referrer).hostname.replace(/^(www|m|l|lm)\./, "")
    for (const [re, name] of SOURCES) if (re.test(host)) return name
    return "otro"
  } catch {
    return "directo"
  }
}

export function detectDevice(ua: string) {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet"
  if (/mobi|iphone|android/i.test(ua)) return "mobile"
  return "desktop"
}

/** Programas que visitan páginas solos (buscadores, vistas previas de enlaces): no cuentan como visitas. */
export const isBot = (ua: string) => !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|headless|lighthouse|python|curl|wget|axios|node-fetch|go-http/i.test(ua)
