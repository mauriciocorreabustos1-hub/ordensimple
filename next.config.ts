import type { NextConfig } from "next"

// Política de contenido: de dónde puede cargar cosas la página. Si alguien lograra meter un script o un
// formulario falso, el navegador lo bloquea. Fuera del propio sitio solo se permite Mercado Pago (formulario
// de tarjeta y pagos) y Vercel (estadísticas de visitas).
const MP = "https://*.mercadopago.com https://*.mercadopago.cl https://*.mercadolibre.com https://*.mercadolibre.cl https://*.mercadolivre.com https://*.mlstatic.com"
const dev = process.env.NODE_ENV !== "production"
const csp = [
  "default-src 'self'",
  // 'unsafe-inline': Next.js escribe pequeños scripts en la página. 'wasm-unsafe-eval': lector de códigos en iPhone.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""} https://sdk.mercadopago.com ${MP} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${MP}`,
  "font-src 'self' data:",
  "media-src 'self' blob:",
  `connect-src 'self' ${MP} https://api.mercadopago.com https://vitals.vercel-insights.com`,
  `frame-src ${MP}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
    // Archivos que no cambian (el nombre lleva la versión) o casi nunca: el navegador los guarda y no los vuelve a bajar.
    const forever = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]
    const week = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }]
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/wasm/:file*", headers: forever },
      { source: "/videos/:file*", headers: week },
      { source: "/brand/:file*", headers: week },
    ]
  },
}

export default nextConfig
