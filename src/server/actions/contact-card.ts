"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { cardPath, contactCardSchema, isValidSlug, type ContactCardInput } from "@/lib/contact-card"
import { parseImageDataUrl } from "@/lib/image-data"
import { requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

const DASHBOARD = "/dashboard/tarjeta"

/**
 * Crea o actualiza la tarjeta de quien tiene la sesión (una por persona). El enlace se elige al crearla y ya no cambia:
 * así el enlace y el QR que ya se repartieron siguen sirviendo.
 */
export async function saveContactCard(input: ContactCardInput): Promise<ActionResult<{ slug: string }>> {
  const ctx = await requireBusiness()
  const parsed = contactCardSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { photo, slug: wantedSlug, published, ...fields } = parsed.data

  let photoData: { photo: Uint8Array<ArrayBuffer> | null; photoType: string | null; photoUpdatedAt: Date | null } | null = null
  if (photo) {
    const img = parseImageDataUrl(photo)
    if ("error" in img) return { ok: false, message: img.error!, fieldErrors: { photo: [img.error!] } }
    // Los contactos del celular y el ícono de la app no leen WebP.
    if (img.type === "image/webp") return { ok: false, message: "Usa una imagen JPG o PNG.", fieldErrors: { photo: ["Usa una imagen JPG o PNG."] } }
    photoData = { photo: new Uint8Array(img.data), photoType: img.type, photoUpdatedAt: new Date() }
  } else if (photo === null) {
    photoData = { photo: null, photoType: null, photoUpdatedAt: null }
  }

  try {
    const [existing, logo] = await Promise.all([
      db.contactCard.findUnique({ where: { userId: ctx.user.id }, select: { id: true, slug: true, photoUpdatedAt: true } }),
      db.businessLogo.findUnique({ where: { businessId: ctx.businessId }, select: { businessId: true } }),
    ])
    const hasPhoto = photoData ? Boolean(photoData.photo) : Boolean(existing?.photoUpdatedAt)
    // Solo queda autorizado lo que de verdad tiene contenido.
    const authorized = published.filter((key) => (key === "photo" ? hasPhoto : key === "logo" ? Boolean(logo) : Boolean(fields[key])))
    const data = { ...fields, published: authorized, businessId: ctx.businessId, ...(photoData ?? {}) }

    let slug: string
    if (existing) {
      slug = existing.slug
      await db.contactCard.update({ where: { id: existing.id }, data })
    } else {
      if (!wantedSlug || !isValidSlug(wantedSlug)) {
        const message = "Usa de 3 a 30 letras minúsculas o números, separados por guiones."
        return { ok: false, message, fieldErrors: { slug: [message] } }
      }
      slug = wantedSlug
      await db.contactCard.create({ data: { ...data, slug, userId: ctx.user.id } })
    }
    revalidatePath(DASHBOARD)
    revalidatePath(cardPath(slug))
    return { ok: true, message: existing ? "Tarjeta actualizada" : "Tarjeta creada", data: { slug } }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const message = "Ese enlace ya está ocupado. Prueba con otro."
      return { ok: false, message, fieldErrors: { slug: [message] } }
    }
    return toActionError(error) as ActionResult<{ slug: string }>
  }
}

/** Borra la tarjeta: el enlace y el QR dejan de funcionar. */
export async function deleteContactCard(): Promise<ActionResult> {
  const ctx = await requireBusiness()
  try {
    const card = await db.contactCard.findUnique({ where: { userId: ctx.user.id }, select: { id: true, slug: true } })
    if (!card) return { ok: false, message: "No tienes una tarjeta." }
    await db.contactCard.delete({ where: { id: card.id } })
    revalidatePath(DASHBOARD)
    revalidatePath(cardPath(card.slug))
    return { ok: true, message: "Tarjeta eliminada" }
  } catch (error) {
    return toActionError(error)
  }
}
