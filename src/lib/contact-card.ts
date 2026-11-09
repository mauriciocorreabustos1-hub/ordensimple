import { z } from "zod"
import { whatsappLink } from "@/lib/whatsapp"

// Tarjetas de presentación digitales: qué se puede publicar, cómo se limpian los datos y el archivo de contacto (.vcf).
// Sin dependencias del servidor: lo usan la página pública, el editor y las pruebas.

export const cardPath = (slug: string) => `/perfil/${slug}`

export const PUBLISHABLE = ["photo", "logo", "jobTitle", "company", "phone", "whatsapp", "email", "website", "instagram", "facebook", "linkedin", "tiktok", "x"] as const
export type PublishableField = (typeof PUBLISHABLE)[number]

// ─── Enlace ─────────────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RESERVED = new Set(["admin", "api", "ayuda", "contacto", "ordensimple", "perfil", "soporte"])

export const isValidSlug = (slug: string) => slug.length >= 3 && slug.length <= 30 && SLUG_RE.test(slug) && !RESERVED.has(slug)

/** Propone un enlace a partir de un nombre: "José Núñez" da "jose-nunez". */
export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "")
}

// ─── Limpieza de datos ──────────────────────────────────────────────────────

/** Teléfono como +56912345678. Un número chileno de 9 dígitos se completa con +56. Si no parece un teléfono, null. */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 9) return `+56${digits}`
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
}

/** Para leerlo: los números chilenos van separados (+56 9 1234 5678). */
export function formatPhone(phone: string) {
  const cl = /^\+56(9)(\d{4})(\d{4})$/.exec(phone)
  return cl ? `+56 ${cl[1]} ${cl[2]} ${cl[3]}` : phone
}

/** Sitio web: solo http o https (nunca otra cosa, como javascript:). Sin protocolo, se asume https. */
export function normalizeWebsite(raw: string) {
  const value = raw.trim()
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`)
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password || !url.hostname.includes(".")) return null
    const href = url.href.replace(/\/$/, "")
    return href.length <= 200 ? href : null
  } catch {
    return null
  }
}

export const SOCIALS = {
  instagram: { label: "Instagram", hosts: ["instagram.com"], url: (h: string) => `https://www.instagram.com/${h}` },
  facebook: { label: "Facebook", hosts: ["facebook.com", "fb.com"], url: (h: string) => `https://www.facebook.com/${h}` },
  linkedin: { label: "LinkedIn", hosts: ["linkedin.com"], url: (h: string) => `https://www.linkedin.com/${h}` },
  tiktok: { label: "TikTok", hosts: ["tiktok.com"], url: (h: string) => `https://www.tiktok.com/@${h}` },
  x: { label: "X", hosts: ["x.com", "twitter.com"], url: (h: string) => `https://x.com/${h}` },
} as const
export type SocialKind = keyof typeof SOCIALS
export const SOCIAL_KINDS = Object.keys(SOCIALS) as SocialKind[]

const HANDLE_RE = /^[A-Za-z0-9._-]{1,80}$/

/** Acepta @usuario, usuario o el enlace completo, y guarda solo el usuario. Un enlace a otro sitio no sirve. */
export function normalizeSocial(kind: SocialKind, raw: string) {
  const value = raw.trim().replace(/^@/, "")
  // Lo que ya está guardado en LinkedIn: al editar la tarjeta vuelve a pasar por aquí.
  if (kind === "linkedin" && /^(in|company)\/[A-Za-z0-9._-]{1,80}$/.test(value)) return value
  const looksLikeUrl = /^https?:\/\//i.test(value) || value.includes("/") || value.includes(".com")
  let parts = [value]
  if (looksLikeUrl) {
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
      const host = url.hostname.replace(/^(www|m|web)\./, "")
      if (!(SOCIALS[kind].hosts as readonly string[]).includes(host)) return null
      parts = url.pathname.split("/").filter(Boolean).map((p) => p.replace(/^@/, ""))
    } catch {
      return null
    }
  }
  if (kind === "linkedin") {
    const [first, second] = parts
    if ((first === "in" || first === "company") && second && HANDLE_RE.test(second)) return `${first}/${second}`
    return parts.length === 1 && HANDLE_RE.test(first) ? `in/${first}` : null
  }
  return parts[0] && HANDLE_RE.test(parts[0]) ? parts[0] : null
}

const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`)

function clean(value: string, ctx: z.RefinementCtx, normalize: (v: string) => string | null, message: string) {
  if (!value) return null
  const result = normalize(value)
  if (!result) ctx.addIssue({ code: "custom", message })
  return result ?? null
}

const phone = text(30).transform((v, ctx) => clean(v, ctx, normalizePhone, "Escribe un teléfono válido, por ejemplo +56 9 1234 5678"))
const social = (kind: SocialKind) =>
  text(200).transform((v, ctx) => clean(v, ctx, (x) => normalizeSocial(kind, x), `Escribe tu usuario de ${SOCIALS[kind].label} o el enlace a tu perfil`))

export const contactCardSchema = z.object({
  slug: z.string().trim().toLowerCase().max(30).optional(),
  active: z.boolean(),
  fullName: text(80).min(2, "Escribe tu nombre"),
  jobTitle: text(80).transform((v) => v || null),
  company: text(80).transform((v) => v || null),
  phone,
  whatsapp: phone,
  email: text(120).transform((v, ctx) => clean(v.toLowerCase(), ctx, (x) => (z.email().safeParse(x).success ? x : null), "Escribe un correo válido")),
  website: text(200).transform((v, ctx) => clean(v, ctx, normalizeWebsite, "Escribe una dirección válida, por ejemplo miempresa.cl")),
  instagram: social("instagram"),
  facebook: social("facebook"),
  linkedin: social("linkedin"),
  tiktok: social("tiktok"),
  x: social("x"),
  published: z.array(z.enum(PUBLISHABLE)).max(PUBLISHABLE.length),
  /** Sin indicar: se mantiene. null: se quita. Texto: foto nueva (data:image/jpeg;base64,…). */
  photo: z.string().max(500_000).nullable().optional(),
})
export type ContactCardInput = z.input<typeof contactCardSchema>

// ─── Lo que se publica ──────────────────────────────────────────────────────

export type ContactCardRow = {
  slug: string
  fullName: string
  jobTitle: string | null
  company: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  tiktok: string | null
  x: string | null
  published: string[]
  photoUpdatedAt: Date | null
  updatedAt: Date
}

export type PublicContactCard = {
  slug: string
  fullName: string
  jobTitle: string | null
  company: string | null
  phone: string | null
  whatsapp: string | null
  whatsappUrl: string | null
  email: string | null
  website: string | null
  socials: { kind: SocialKind; label: string; url: string }[]
  photoUrl: string | null
  logoUrl: string | null
  version: number
}

/**
 * La única puerta de salida de los datos: todo lo que no esté autorizado en `published` queda en null.
 * La página, el archivo de contacto y la app instalada se arman desde aquí.
 */
export function toPublicCard(row: ContactCardRow, logoUrl: string | null): PublicContactCard {
  const allowed = new Set(row.published)
  const pick = <T,>(field: PublishableField, value: T | null) => (allowed.has(field) ? value : null)
  const whatsapp = pick("whatsapp", row.whatsapp)
  return {
    slug: row.slug,
    fullName: row.fullName,
    jobTitle: pick("jobTitle", row.jobTitle),
    company: pick("company", row.company),
    phone: pick("phone", row.phone),
    whatsapp,
    whatsappUrl: whatsapp ? whatsappLink(whatsapp) : null,
    email: pick("email", row.email),
    website: pick("website", row.website),
    socials: SOCIAL_KINDS.flatMap((kind) => {
      const handle = pick(kind, row[kind])
      return handle ? [{ kind, label: SOCIALS[kind].label, url: SOCIALS[kind].url(handle) }] : []
    }),
    photoUrl: allowed.has("photo") && row.photoUpdatedAt ? `${cardPath(row.slug)}/foto?v=${row.photoUpdatedAt.getTime()}` : null,
    logoUrl: allowed.has("logo") ? logoUrl : null,
    version: row.updatedAt.getTime(),
  }
}

export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase()
}

// ─── Archivo de contacto (vCard 3.0, el formato que leen iPhone y Android) ──

const escapeValue = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1")

/** Las líneas no pueden pasar de 75 bytes: se cortan sin partir una letra y la continuación parte con un espacio. */
function foldLine(line: string) {
  const out: string[] = []
  let current = ""
  let bytes = 0
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8")
    if (bytes + size > 75) {
      out.push(current)
      current = " "
      bytes = 1
    }
    current += char
    bytes += size
  }
  out.push(current)
  return out.join("\r\n")
}

export function buildVCard(card: PublicContactCard, opts: { url: string; photo?: { type: string; base64: string } | null }) {
  const words = card.fullName.trim().split(/\s+/)
  const given = words[0] ?? ""
  const family = words.slice(1).join(" ")
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${escapeValue(family)};${escapeValue(given)};;;`, `FN:${escapeValue(card.fullName)}`]
  if (card.company) lines.push(`ORG:${escapeValue(card.company)}`)
  if (card.jobTitle) lines.push(`TITLE:${escapeValue(card.jobTitle)}`)
  if (card.phone) lines.push(`TEL;TYPE=CELL:${card.phone}`)
  if (card.whatsapp && card.whatsapp !== card.phone) lines.push(`item1.TEL;TYPE=CELL:${card.whatsapp}`, "item1.X-ABLabel:WhatsApp")
  if (card.email) lines.push(`EMAIL;TYPE=INTERNET:${card.email}`)
  if (card.website) lines.push(`URL:${card.website}`)
  lines.push(`item2.URL:${opts.url}`, "item2.X-ABLabel:Tarjeta digital")
  for (const s of card.socials) lines.push(`X-SOCIALPROFILE;TYPE=${s.kind}:${s.url}`)
  // WebP no lo leen los contactos: solo van JPEG y PNG.
  if (opts.photo && (opts.photo.type === "image/jpeg" || opts.photo.type === "image/png")) {
    lines.push(`PHOTO;ENCODING=b;TYPE=${opts.photo.type === "image/png" ? "PNG" : "JPEG"}:${opts.photo.base64}`)
  }
  lines.push("END:VCARD")
  return `${lines.map(foldLine).join("\r\n")}\r\n`
}
