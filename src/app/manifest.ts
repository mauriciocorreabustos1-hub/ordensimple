import type { MetadataRoute } from "next"

// Base para instalar OrdenSimple como app. El service worker se agregará en una fase posterior.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OrdenSimple",
    short_name: "OrdenSimple",
    description: "Administra tu negocio sin complicarte.",
    lang: "es-CL",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8faf9",
    theme_color: "#007653",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
