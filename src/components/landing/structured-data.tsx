import { getAppUrl } from "@/lib/app-url"
import { WHATSAPP } from "@/lib/contact"
import { SOCIAL_LINKS } from "@/components/landing/social-links"

/**
 * Datos estructurados (schema.org) para Google: nombre del sitio, logo y qué es OrdenSimple.
 * Ayudan a que el resultado de búsqueda muestre "OrdenSimple" con su ícono.
 */
export function StructuredData() {
  const url = getAppUrl()
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name: "OrdenSimple",
        alternateName: ["Orden Simple", "ordensimple.cl"],
        url,
        inLanguage: "es-CL",
        publisher: { "@id": `${url}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: "OrdenSimple",
        url,
        logo: `${url}/pwa-icon/512`,
        email: "contacto@ordensimple.cl",
        telephone: WHATSAPP.phone,
        contactPoint: { "@type": "ContactPoint", telephone: WHATSAPP.phone, contactType: "customer service", availableLanguage: "es", areaServed: "CL" },
        areaServed: "CL",
        sameAs: SOCIAL_LINKS.map((s) => s.href),
      },
      {
        "@type": "SoftwareApplication",
        name: "OrdenSimple",
        url,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Android, iOS",
        inLanguage: "es-CL",
        description:
          "OrdenSimple es un software de gestión para emprendedores y pymes en Chile. Administra ventas, inventario, clientes, gastos y caja desde un solo lugar. Comienza gratis.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "CLP", description: "Plan Gratis" },
        publisher: { "@id": `${url}/#organization` },
      },
    ],
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  )
}
