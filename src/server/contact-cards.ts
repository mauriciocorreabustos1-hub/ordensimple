import "server-only"
import { cache } from "react"
import { db } from "@/lib/db"
import { isValidSlug, toPublicCard } from "@/lib/contact-card"

// Lo público de una tarjeta. La foto nunca viene aquí: tiene su propia dirección y solo responde si está autorizada.
const SELECT = {
  slug: true,
  active: true,
  fullName: true,
  jobTitle: true,
  company: true,
  phone: true,
  whatsapp: true,
  email: true,
  website: true,
  instagram: true,
  facebook: true,
  linkedin: true,
  tiktok: true,
  x: true,
  published: true,
  photoUpdatedAt: true,
  updatedAt: true,
  business: { select: { id: true, logoUpdatedAt: true } },
} as const

export const getPublicCard = cache(async (slug: string) => {
  if (!isValidSlug(slug)) return null
  const row = await db.contactCard.findUnique({ where: { slug }, select: SELECT })
  if (!row || !row.active) return null
  const logo = row.business?.logoUpdatedAt ? `/logo/${row.business.id}?v=${row.business.logoUpdatedAt.getTime()}` : null
  return toPublicCard(row, logo)
})

/** Bytes de la foto, solo si la tarjeta está activa y la persona autorizó mostrarla. */
export async function getPublicCardPhoto(slug: string) {
  if (!isValidSlug(slug)) return null
  const row = await db.contactCard.findUnique({ where: { slug }, select: { active: true, published: true, photo: true, photoType: true } })
  if (!row?.active || !row.published.includes("photo") || !row.photo || !row.photoType) return null
  return { data: row.photo, type: row.photoType }
}
