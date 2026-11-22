import type { MetadataRoute } from "next"
import { getAppUrl } from "@/lib/app-url"
import { db } from "@/lib/db"
import { linkPublicUrl } from "@/server/links"

// Páginas públicas para buscadores (Google, Bing).
const PAGES = [
  "",
  "/funciones",
  "/restaurantes",
  "/como-funciona",
  "/demo",
  "/precios",
  "/instalar",
  "/descargar",
  "/preguntas-frecuentes",
  "/calculadoras",
  "/calculadoras/precio-de-venta",
  "/calculadoras/punto-de-equilibrio",
  "/calculadoras/meta-de-ganancia",
  "/guias",
  "/guias/como-llevar-el-fiado",
  "/guias/como-hacer-el-cierre-de-caja",
  "/guias/como-calcular-la-ganancia-de-tu-negocio",
  "/registro",
  "/login",
  "/terminos",
  "/privacidad",
]

// Se rehace cada día: así suma las páginas de OrdenSimple Links que se van publicando.
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppUrl()
  const pages: MetadataRoute.Sitemap = PAGES.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : path === "/login" ? 0.3 : 0.8,
  }))
  // Las páginas de enlaces publicadas (si la base no responde, el mapa sale igual con las páginas del sitio).
  const links = await db.linkPage
    .findMany({ where: { published: true }, select: { slug: true, publishedAt: true }, orderBy: { publishedAt: "desc" }, take: 5000 })
    .catch(() => [])
  return [...pages, ...links.map((l) => ({ url: linkPublicUrl(l.slug), lastModified: l.publishedAt ?? undefined, changeFrequency: "weekly" as const, priority: 0.5 }))]
}
