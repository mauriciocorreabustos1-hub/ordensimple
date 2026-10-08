import postcss from "postcss"
import cascadeLayers from "@csstools/postcss-cascade-layers"

/**
 * Estilos para navegadores antiguos (Android System WebView sin actualizar, navegadores dentro de apps).
 * Tailwind pone todos los estilos dentro de @layer, que esos navegadores no entienden: los descartan y la
 * página se ve sin formato. Aquí se toman los mismos archivos CSS de la página y se reescriben sin @layer.
 * Solo los pide el script de src/app/layout.tsx cuando el navegador no conoce @layer: los navegadores
 * modernos siguen usando el CSS original, sin cambios.
 */
const CSS_PATH = /^\/_next\/static\/[\w./%[\]-]+\.css(\?[\w=&.-]*)?$/

const cache = new Map<string, Promise<string>>()

async function build(origin: string, paths: string[]) {
  const sources = await Promise.all(
    paths.map(async (p) => {
      const res = await fetch(origin + p, { cache: "force-cache" })
      return res.ok ? await res.text() : ""
    }),
  )
  const result = await postcss([cascadeLayers()]).process(sources.join("\n"), { from: undefined })
  return result.css
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const paths = (url.searchParams.get("f") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => CSS_PATH.test(p) && !p.includes(".."))
    .slice(0, 12)
  if (!paths.length) return new Response("/* sin estilos */", { status: 400, headers: { "Content-Type": "text/css; charset=utf-8" } })

  const key = paths.join(",")
  if (!cache.has(key)) {
    cache.set(key, build(url.origin, paths))
    if (cache.size > 50) cache.delete(cache.keys().next().value!)
  }
  try {
    const css = await cache.get(key)!
    return new Response(css, {
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        // Los nombres de los archivos cambian con cada publicación, así que se puede guardar para siempre.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    cache.delete(key)
    return new Response("/* no se pudieron preparar los estilos */", { status: 502, headers: { "Content-Type": "text/css; charset=utf-8" } })
  }
}
