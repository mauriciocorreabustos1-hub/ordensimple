// Service worker de OrdenSimple: solo recibe los avisos en el celular (no guarda páginas ni datos).

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "OrdenSimple", body: event.data ? event.data.text() : "" }
  }
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/dashboard"
  event.waitUntil(
    self.registration.showNotification(data.title || "OrdenSimple", {
      body: data.body || "",
      icon: "/pwa-icon/192",
      badge: "/pwa-icon/192",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url },
    }),
  )
})

// Al tocar el aviso: si la app ya está abierta se usa esa ventana; si no, se abre una nueva.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          return w.focus().then(() => ("navigate" in w ? w.navigate(url) : undefined))
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
