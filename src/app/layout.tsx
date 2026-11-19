import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google"
import { Providers } from "@/components/providers"
import { getAppUrl } from "@/lib/app-url"
import { ORIGIN_SCRIPT } from "@/lib/signup-source"
import "./globals.css"

// Aplica el tema guardado (o el del sistema) antes de que se dibuje la página, para que no parpadee.
// Debe coincidir con src/lib/theme.ts (misma clave y valores).
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d)r.classList.add("dark");r.style.colorScheme=d?"dark":"light"}catch(e){}})()`

// Navegadores antiguos (sin @layer, anteriores a 2022) descartan todos los estilos de Tailwind y la página se ve
// sin formato. Solo en esos casos se carga una copia compatible (src/app/estilos-compatibles.css). Escrito en
// JavaScript antiguo a propósito, para que esos navegadores lo puedan ejecutar.
const LEGACY_CSS_SCRIPT = `(function(){try{if(window.CSSLayerBlockRule)return;var add=function(){var h=[].map.call(document.querySelectorAll('link[rel="stylesheet"][href*="/_next/static/"]'),function(l){return l.getAttribute("href")});if(!h.length)return;var l=document.createElement("link");l.rel="stylesheet";l.href="/estilos-compatibles.css?f="+encodeURIComponent(h.join(","));document.head.appendChild(l)};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",add);else add()}catch(e){}})()`

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
// Se usa poco (códigos, la boleta de la portada): no se descarga por adelantado en todas las páginas.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false })
// Títulos de la web pública: una letra con más carácter que la del texto.
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["500", "600", "700"] })

const SITE_DESCRIPTION =
  "OrdenSimple es un software de gestión para emprendedores y pymes en Chile. Administra ventas, inventario, clientes, gastos y caja desde un solo lugar. Comienza gratis."

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: "OrdenSimple — Administra tu negocio sin complicarte",
    template: "%s · OrdenSimple",
  },
  description: SITE_DESCRIPTION,
  applicationName: "OrdenSimple",
  // OrdenSimple es un producto de Orfex Group.
  authors: [{ name: "Orfex Group", url: "https://www.orfex.cl" }],
  creator: "Orfex Group",
  publisher: "Orfex Group",
  // Código de Google Search Console (variable GOOGLE_SITE_VERIFICATION en Vercel).
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
  appleWebApp: { capable: true, title: "OrdenSimple", statusBarStyle: "default" },
  // El ícono debe declararse junto al de iPhone: si solo se pone "apple", Google no encuentra el favicon.
  // (favicon.ico se agrega solo desde src/app/favicon.ico.)
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
    ],
    apple: "/pwa-icon/180",
  },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "OrdenSimple",
    title: "OrdenSimple — Administra tu negocio sin complicarte",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "OrdenSimple — Administra tu negocio sin complicarte",
    description: SITE_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#151c1a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // En Android, el teclado achica la pantalla (como en iPhone) y no tapa el botón de guardar.
  interactiveWidget: "resizes-content",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CL"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LEGACY_CSS_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ORIGIN_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
