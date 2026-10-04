import type { MetadataRoute } from "next"
import { getAppUrl } from "@/lib/app-url"

// Páginas públicas para buscadores (Google, Bing).
const PAGES = [
  "",
  "/funciones",
  "/como-funciona",
  "/precios",
  "/preguntas-frecuentes",
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
