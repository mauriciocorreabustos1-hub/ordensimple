import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Geist, Geist_Mono } from "next/font/google"
import { Providers } from "@/components/providers"
import { getAppUrl } from "@/lib/app-url"
import "./globals.css"

// Aplica el tema guardado (o el del sistema) antes de que se dibuje la página, para que no parpadee.
// Debe coincidir con src/lib/theme.ts (misma clave y valores).
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d)r.classList.add("dark");r.style.colorScheme=d?"dark":"light"}catch(e){}})()`

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: "OrdenSimple — Administra tu negocio sin complicarte",
    template: "%s · OrdenSimple",
  },
  description:
    "Controla tus ventas, gastos, productos y ganancias desde un solo lugar. Hecho para emprendedores y pymes de Chile.",
  applicationName: "OrdenSimple",
  appleWebApp: { capable: true, title: "OrdenSimple", statusBarStyle: "default" },
  icons: { apple: "/pwa-icon/180" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "OrdenSimple",
    title: "OrdenSimple — Administra tu negocio sin complicarte",
    description: "Controla tus ventas, gastos, productos y ganancias desde un solo lugar. Gratis para empezar.",
  },
  twitter: {
    card: "summary_large_image",
    title: "OrdenSimple — Administra tu negocio sin complicarte",
    description: "Controla tus ventas, gastos, productos y ganancias desde un solo lugar.",
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
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CL"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
