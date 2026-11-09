import type { Metadata, Viewport } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import QRCode from "qrcode"
import { CardActions } from "@/components/contact-card/card-actions"
import { CardFace } from "@/components/contact-card/card-face"
import { getAppUrl } from "@/lib/app-url"
import { cardPath } from "@/lib/contact-card"
import { getPublicCard } from "@/server/contact-cards"

// Tarjeta de presentación pública. Solo muestra lo que la persona autorizó, y no aparece en buscadores.

export async function generateMetadata({ params }: PageProps<"/perfil/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const card = await getPublicCard(slug)
  if (!card) return { title: { absolute: "Tarjeta no encontrada" }, robots: { index: false, follow: false } }
  const path = cardPath(card.slug)
  return {
    title: { absolute: card.fullName },
    description: [card.jobTitle, card.company].filter(Boolean).join(", ") || "Tarjeta de presentación digital",
    robots: { index: false, follow: false },
    // Al instalarla se abre esta tarjeta, con su nombre y su ícono (no el panel de OrdenSimple).
    manifest: `${path}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: card.fullName.split(" ")[0], statusBarStyle: "black-translucent" },
    icons: { apple: `${path}/icono/180?v=${card.version}` },
  }
}

export const viewport: Viewport = { themeColor: "#014f36" }

export default async function ContactCardPage({ params }: PageProps<"/perfil/[slug]">) {
  const { slug } = await params
  const card = await getPublicCard(slug)
  if (!card) notFound()
  const path = cardPath(card.slug)
  const url = `${getAppUrl()}${path}`
  // El QR lleva solo el enlace, que no cambia: lo que se edita aparece solo, sin volver a imprimirlo.
  const [qr, qrLarge] = await Promise.all([
    QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M" }),
    QRCode.toDataURL(url, { margin: 1, width: 900, errorCorrectionLevel: "M" }),
  ])

  return (
    <div className="min-h-dvh bg-deep pb-[env(safe-area-inset-bottom)] sm:py-10">
      {/* En iPhone, la franja bajo la hora y la batería va del color de la tarjeta. */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-[61] h-[env(safe-area-inset-top)] bg-deep" />
      <main className="mx-auto max-w-md">
        <CardFace card={card} actions={<CardActions path={path} url={url} name={card.fullName} qr={qrLarge} />}>
          <section aria-label="Código QR" className="flex items-center gap-4 border-t pt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`Código QR de la tarjeta de ${card.fullName}`} className="size-28 shrink-0 rounded-lg" />
            <p className="text-sm text-pretty text-muted-foreground">Escanea este código con la cámara del celular para abrir esta tarjeta.</p>
          </section>
          <p className="text-center text-xs text-muted-foreground">
            Tarjeta creada con{" "}
            <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
              OrdenSimple
            </Link>
          </p>
        </CardFace>
      </main>
    </div>
  )
}
