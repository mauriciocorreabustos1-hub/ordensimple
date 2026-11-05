import type { MetadataRoute } from "next"
import { getAppUrl } from "@/lib/app-url"

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

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppUrl()
  return PAGES.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : path === "/login" ? 0.3 : 0.8,
  }))
}
