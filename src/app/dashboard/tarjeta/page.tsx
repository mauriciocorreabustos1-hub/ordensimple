import type { Metadata } from "next"
import QRCode from "qrcode"
import { PageHeader } from "@/components/app/page-header"
import { ContactCardEditor } from "@/components/contact-card/editor"
import { getAppUrl } from "@/lib/app-url"
import { cardPath } from "@/lib/contact-card"
import { db } from "@/lib/db"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Tarjeta digital" }

export default async function ContactCardDashboardPage() {
  const ctx = await requireBusiness()
  const [card, logo] = await Promise.all([db.contactCard.findUnique({ where: { userId: ctx.user.id } }), db.businessLogo.findUnique({ where: { businessId: ctx.businessId }, select: { updatedAt: true } })])
  const origin = getAppUrl()
  const url = card ? `${origin}${cardPath(card.slug)}` : null
  const qr = url ? await QRCode.toDataURL(url, { margin: 1, width: 720, errorCorrectionLevel: "M" }) : null

  return (
    <div className="space-y-6">
      <PageHeader title="Tarjeta digital" description="Tu tarjeta de presentación con enlace y código QR. Solo se publica lo que tú actives." />
      <ContactCardEditor
        key={card?.slug ?? "nueva"}
        host={origin.replace(/^https?:\/\//, "")}
        url={url}
        qr={qr}
        logoUrl={logo ? `/logo/${ctx.businessId}?v=${logo.updatedAt.getTime()}` : null}
        initial={
          card
            ? {
                slug: card.slug,
                active: card.active,
                fullName: card.fullName,
                jobTitle: card.jobTitle ?? "",
                company: card.company ?? "",
                phone: card.phone ?? "",
                whatsapp: card.whatsapp ?? "",
                email: card.email ?? "",
                website: card.website ?? "",
                instagram: card.instagram ?? "",
                facebook: card.facebook ?? "",
                linkedin: card.linkedin ?? "",
                tiktok: card.tiktok ?? "",
                x: card.x ?? "",
                published: card.published,
                photo: card.photo && card.photoType ? `data:${card.photoType};base64,${Buffer.from(card.photo).toString("base64")}` : null,
              }
            : null
        }
        // Se proponen desde la cuenta, pero nada se publica hasta que la persona lo active.
        prefill={{ fullName: ctx.user.name, email: ctx.user.email, company: ctx.business.name }}
      />
    </div>
  )
}
