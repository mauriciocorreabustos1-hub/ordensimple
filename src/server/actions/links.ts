"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { parseImageDataUrl } from "@/lib/image-data"
import {
  contentImages,
  contentSchema,
  initialContent,
  linkPath,
  proFeaturesUsed,
  publishProblems,
  readContent,
  slugProblem,
  type LinkContent,
} from "@/lib/links"
import { canUseFeature, effectivePlan } from "@/lib/plans"
import { storePath } from "@/lib/store"
import { getAppUrl } from "@/lib/app-url"
import { allowAttempt } from "@/server/rate-limit"
import { assertCan, requireBusiness } from "@/server/session"
import { bookingUrlFor, LINK_BUSINESS_SELECT, linksPro } from "@/server/links"
import { toActionError, type ActionResult } from "@/server/actions/result"

const DASHBOARD = "/dashboard/links"
const MAX_IMAGES = 60

/** Solo el dueño y los administradores editan la página del negocio. El negocio sale de la sesión, nunca del navegador. */
async function context() {
  const ctx = await requireBusiness()
  assertCan(ctx, "settings:manage")
  return ctx
}

/** ¿Lo tiene otra página (o lo tuvo y lo dejó)? Los nombres viejos siguen reservados para sus enlaces y QR. */
async function slugTaken(slug: string, exceptPageId?: string) {
  const row = await db.linkPage.findFirst({
    where: { OR: [{ slug }, { oldSlugs: { has: slug } }], ...(exceptPageId ? { NOT: { id: exceptPageId } } : {}) },
    select: { id: true },
  })
  return Boolean(row)
}

/** Revisa si un nombre de usuario está libre (mientras se escribe). */
export async function checkLinkSlug(slug: string): Promise<ActionResult> {
  const ctx = await context()
  const value = slug.trim().toLowerCase()
  const problem = slugProblem(value)
  if (problem) return { ok: false, message: problem }
  if (!(await allowAttempt(`links-slug:${ctx.user.id}`, 60, 10 * 60_000))) return { ok: false, message: "Espera un momento antes de seguir probando nombres." }
  const mine = await db.linkPage.findUnique({ where: { businessId: ctx.businessId }, select: { id: true, slug: true, oldSlugs: true } })
  if (mine?.slug === value) return { ok: true, message: "Es tu nombre actual." }
  if (await slugTaken(value, mine?.id)) return { ok: false, message: "Ese nombre ya está ocupado. Prueba con otro." }
  return { ok: true, message: "Disponible" }
}

/** Crea la página del negocio con sus datos reales (nombre, logo, WhatsApp, tienda y reservas si las tiene). */
export async function createLinkPage(slug: string): Promise<ActionResult<{ slug: string }>> {
  const ctx = await context()
  const value = slug.trim().toLowerCase()
  const problem = slugProblem(value)
  if (problem) return { ok: false, message: problem, fieldErrors: { slug: [problem] } }
  try {
    if (await db.linkPage.findUnique({ where: { businessId: ctx.businessId }, select: { id: true } })) return { ok: false, message: "Tu negocio ya tiene su página." }
    if (await slugTaken(value)) return { ok: false, message: "Ese nombre ya está ocupado. Prueba con otro.", fieldErrors: { slug: ["Ese nombre ya está ocupado."] } }
    const b = await db.business.findUniqueOrThrow({ where: { id: ctx.businessId }, select: LINK_BUSINESS_SELECT })
    const storeOn = Boolean(b.storeEnabled && b.storeSlug && b.storeWhatsapp && canUseFeature(effectivePlan(b), "store"))
    const content = initialContent({
      name: b.name,
      whatsapp: b.storeWhatsapp,
      storeUrl: storeOn ? `${getAppUrl()}${storePath(b.storeSlug!)}` : null,
      canBook: Boolean(await bookingUrlFor(b)),
    })
    await db.linkPage.create({ data: { businessId: ctx.businessId, slug: value, draft: content } })
    revalidatePath(DASHBOARD)
    return { ok: true, message: "¡Listo! Tu página está creada", data: { slug: value } }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, message: "Ese nombre ya está ocupado. Prueba con otro." }
    return toActionError(error) as ActionResult<{ slug: string }>
  }
}

/**
 * Limpia lo que no es de este negocio: fotos que no subió esta página y productos de otro negocio se quitan.
 * Así nadie puede mostrar en su página fotos o productos ajenos cambiando los datos que manda el navegador.
 */
async function ownedOnly(pageId: string, businessId: string, content: LinkContent): Promise<LinkContent> {
  const imageIds = contentImages(content)
  const productIds = content.blocks.flatMap((b) => (b.type === "products" ? b.productIds : []))
  const [images, products] = await Promise.all([
    imageIds.length ? db.linkImage.findMany({ where: { id: { in: imageIds }, pageId }, select: { id: true } }) : [],
    productIds.length ? db.product.findMany({ where: { id: { in: productIds }, businessId }, select: { id: true } }) : [],
  ])
  const okImg = new Set(images.map((i) => i.id))
  const okProd = new Set(products.map((p) => p.id))
  const img = (id: string | null) => (id && okImg.has(id) ? id : null)
  return {
    ...content,
    profile: { ...content.profile, avatar: img(content.profile.avatar), cover: img(content.profile.cover) },
    theme: { ...content.theme, bg: { ...content.theme.bg, image: img(content.theme.bg.image) } },
    blocks: content.blocks.map((b) =>
      b.type === "image" ? { ...b, image: img(b.image) } : b.type === "link" ? { ...b, thumb: img(b.thumb) } : b.type === "products" ? { ...b, productIds: b.productIds.filter((id) => okProd.has(id)) } : b,
    ),
  }
}

/** Guarda el borrador (lo llama el editor solo, mientras se edita). Lo publicado no cambia hasta publicar. */
export async function saveLinkDraft(input: unknown): Promise<ActionResult<{ savedAt: number }>> {
  const ctx = await context()
  const parsed = contentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." }
  try {
    const page = await db.linkPage.findUnique({ where: { businessId: ctx.businessId }, select: { id: true } })
    if (!page) return { ok: false, message: "Primero crea tu página." }
    const content = await ownedOnly(page.id, ctx.businessId, parsed.data)
    await db.linkPage.update({ where: { id: page.id }, data: { draft: content } })
    return { ok: true, data: { savedAt: Date.now() } }
  } catch (error) {
    return toActionError(error) as ActionResult<{ savedAt: number }>
  }
}

/** Borra las fotos que ya no usa ni el borrador ni lo publicado (las de la última hora se dejan, por si se está editando). */
async function cleanImages(pageId: string, keep: string[]) {
  await db.linkImage.deleteMany({ where: { pageId, id: { notIn: keep }, createdAt: { lt: new Date(Date.now() - 60 * 60_000) } } })
}

/** Publica el borrador: revisa que esté completo y que lo Pro venga con el plan Pro. */
export async function publishLinkPage(): Promise<ActionResult<{ problems?: string[] }>> {
  const ctx = await context()
  try {
    const page = await db.linkPage.findUnique({ where: { businessId: ctx.businessId }, select: { id: true, slug: true, draft: true, live: true } })
    if (!page) return { ok: false, message: "Primero crea tu página." }
    const draft = readContent(page.draft)
    if (!draft) return { ok: false, message: "No pudimos leer tu página. Recarga e inténtalo de nuevo." }
    const problems = publishProblems(draft)
    if (problems.length) return { ok: false, message: problems[0], fieldErrors: { problems } }
    if (!linksPro(ctx.business)) {
      const pro = proFeaturesUsed(draft)
      if (pro.length) return { ok: false, message: `Esto es del plan Pro: ${pro.join(", ")}. Quítalo o pásate a Pro para publicar.`, fieldErrors: { pro } }
    }
    await db.linkPage.update({ where: { id: page.id }, data: { live: draft, published: true, publishedAt: new Date() } })
    const old = readContent(page.live)
    await cleanImages(page.id, [...contentImages(draft), ...(old ? contentImages(old) : [])])
    revalidatePath(linkPath(page.slug))
    revalidatePath(DASHBOARD)
    return { ok: true, message: "Publicada. Ya se ve en internet" }
  } catch (error) {
    return toActionError(error) as ActionResult<{ problems?: string[] }>
  }
}

/** Deja de mostrarla: la dirección responde como si no existiera. Lo escrito no se pierde. */
export async function unpublishLinkPage(): Promise<ActionResult> {
  const ctx = await context()
  try {
    const page = await db.linkPage.update({ where: { businessId: ctx.businessId }, data: { published: false }, select: { slug: true } })
    revalidatePath(linkPath(page.slug))
    revalidatePath(DASHBOARD)
    return { ok: true, message: "Tu página ya no se ve en internet" }
  } catch (error) {
    return toActionError(error)
  }
}

/** Vuelve el borrador a lo que está publicado. */
export async function discardLinkDraft(): Promise<ActionResult> {
  const ctx = await context()
  try {
    const page = await db.linkPage.findUnique({ where: { businessId: ctx.businessId }, select: { id: true, live: true } })
    if (!page?.live) return { ok: false, message: "Todavía no has publicado nada." }
    await db.linkPage.update({ where: { id: page.id }, data: { draft: page.live } })
    revalidatePath(DASHBOARD)
    return { ok: true, message: "Volviste a lo publicado" }
  } catch (error) {
    return toActionError(error)
  }
}

/** Cambia el nombre de usuario. El anterior queda guardado para que los enlaces y el QR viejos sigan llevando aquí. */
export async function changeLinkSlug(slug: string): Promise<ActionResult<{ slug: string }>> {
  const ctx = await context()
  const value = slug.trim().toLowerCase()
  const problem = slugProblem(value)
  if (problem) return { ok: false, message: problem }
  try {
    const page = await db.linkPage.findUnique({ where: { businessId: ctx.businessId }, select: { id: true, slug: true, oldSlugs: true } })
    if (!page) return { ok: false, message: "Primero crea tu página." }
    if (page.slug === value) return { ok: true, message: "Es tu nombre actual.", data: { slug: value } }
    if (await slugTaken(value, page.id)) return { ok: false, message: "Ese nombre ya está ocupado. Prueba con otro." }
    if (!(await allowAttempt(`links-rename:${ctx.businessId}`, 3, 24 * 60 * 60_000))) return { ok: false, message: "Puedes cambiar el nombre hasta 3 veces al día. Inténtalo mañana." }
    // Se guardan los últimos 5 nombres (el nuevo sale de la lista si había sido tuyo antes).
    const oldSlugs = [page.slug, ...page.oldSlugs.filter((s) => s !== value)].slice(0, 5)
    await db.linkPage.update({ where: { id: page.id }, data: { slug: value, oldSlugs } })
    revalidatePath(linkPath(page.slug))
    revalidatePath(linkPath(value))
    revalidatePath(DASHBOARD)
    return { ok: true, message: "Nombre cambiado. Los enlaces viejos llevan al nuevo", data: { slug: value } }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, message: "Ese nombre ya está ocupado. Prueba con otro." }
    return toActionError(error) as ActionResult<{ slug: string }>
  }
}

/** Sube una foto ya achicada en el celular (JPG, PNG o WebP de hasta 300 KB). Devuelve su id. */
export async function uploadLinkImage(dataUrl: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await context()
  const img = parseImageDataUrl(dataUrl, 300 * 1024)
  if ("error" in img) return { ok: false, message: img.error! }
  try {
    const page = await db.linkPage.findUnique({ where: { businessId: ctx.businessId }, select: { id: true, draft: true, live: true } })
    if (!page) return { ok: false, message: "Primero crea tu página." }
    if (!(await allowAttempt(`links-upload:${ctx.businessId}`, 40, 60 * 60_000))) return { ok: false, message: "Subiste muchas fotos seguidas. Espera un rato." }
    if ((await db.linkImage.count({ where: { pageId: page.id } })) >= MAX_IMAGES) {
      const keep = [readContent(page.draft), readContent(page.live)].flatMap((c) => (c ? contentImages(c) : []))
      await db.linkImage.deleteMany({ where: { pageId: page.id, id: { notIn: keep }, createdAt: { lt: new Date(Date.now() - 60 * 60_000) } } })
      if ((await db.linkImage.count({ where: { pageId: page.id } })) >= MAX_IMAGES) return { ok: false, message: `Tu página ya tiene ${MAX_IMAGES} fotos. Borra alguna antes de subir otra.` }
    }
    const row = await db.linkImage.create({ data: { pageId: page.id, data: new Uint8Array(img.data), type: img.type }, select: { id: true } })
    return { ok: true, data: { id: row.id } }
  } catch (error) {
    return toActionError(error) as ActionResult<{ id: string }>
  }
}
