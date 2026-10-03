import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Providers } from "@/components/providers"
import { getAppUrl } from "@/lib/app-url"
import "./globals.css"

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
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
