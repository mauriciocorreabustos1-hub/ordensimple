import { cardPath } from "@/lib/contact-card"
import { getPublicCard } from "@/server/contact-cards"

// Service worker de cada tarjeta: permite abrirla sin señal, que es justo cuando más se necesita al presentarse.
// Vale solo para esta tarjeta y no toca el de los avisos del panel. Si la tarjeta se borra o se apaga, se quita la copia guardada.
function script(page: string) {
  return `const PAGE = ${JSON.stringify(page)}
const CACHE = "tarjeta-v1"

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(PAGE)).catch(() => {}).then(() => self.skipWaiting()))
})
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // La tarjeta: siempre la versión nueva; la guardada, solo si no hay conexión.
  if (url.pathname === PAGE && request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        fetch(request)
          .then((response) => {
            if (response.ok) cache.put(PAGE, response.clone())
            else if (response.status === 404) cache.delete(PAGE)
            return response
          })
          .catch(() => cache.match(PAGE).then((saved) => saved || Response.error())),
      ),
    )
    return
  }

  // Archivos que no cambian (llevan su versión en el nombre).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then(
          (saved) =>
            saved ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone())
              return response
            }),
        ),
      ),
    )
    return
  }

  // La foto y el logo: de la red, y la copia guardada solo sin conexión.
  if (url.pathname === PAGE + "/foto" || url.pathname.startsWith("/logo/")) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone())
            else cache.delete(request)
            return response
          })
          .catch(() => cache.match(request).then((saved) => saved || Response.error())),
      ),
    )
  }
})
`
}

export async function GET(_request: Request, { params }: RouteContext<"/perfil/[slug]/sw.js">) {
  const { slug } = await params
  const card = await getPublicCard(slug)
  if (!card) return new Response("No encontrada", { status: 404 })
  const path = cardPath(card.slug)
  return new Response(script(path), {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache, max-age=0", "Service-Worker-Allowed": path },
  })
}
