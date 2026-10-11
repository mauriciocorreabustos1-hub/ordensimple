import type { NextConfig } from "next"

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Obliga a usar siempre la conexión segura (https) durante 2 años.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La cámara se permite en el propio sitio: la usa el escáner de códigos de barras.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // La dirección antigua de Vercel lleva al dominio propio (un solo origen para sesiones y buscadores).
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "ordensimple.vercel.app" }],
        destination: "https://www.ordensimple.cl/:path*",
        permanent: true,
      },
    ]
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
