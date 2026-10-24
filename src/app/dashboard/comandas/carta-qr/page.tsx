import type { Metadata } from "next"
import Link from "next/link"
import QRCode from "qrcode"
import { QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { businessLogoUrl } from "@/components/app/business-logo"
import { QrSheet, type QrCard } from "@/components/comandas/qr-sheet"
import { getAppUrl } from "@/lib/app-url"
import { isFoodBusiness, tableLabels } from "@/lib/business-kind"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { storePath } from "@/lib/store"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Carta con QR" }

const TITLE = "Carta con QR"
const DESCRIPTION = "Un código QR para cada mesa: tus clientes ven la carta con fotos y precios, y pueden pedir desde la mesa."

export default async function MenuQrPage() {
  const ctx = await requireBusiness()
  if (!isFoodBusiness(ctx.business.type)) {
    return (
      <div className="space-y-6">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <EmptyState icon={QrCode} title="La carta con QR es para restaurantes, cafés y negocios de comida" description="Si tu negocio es de comida, márcalo en Configuración (rubro “Restaurante, café o comida”)." />
      </div>
    )
  }
  if (!canUseFeature(ctx.business.plan, "store")) {
    return <ProGate title={TITLE} description="Imprime un código QR para cada mesa: tus clientes ven la carta con fotos y precios y te piden desde la mesa." />
  }
  const slug = ctx.business.storeSlug
  if (!ctx.business.storeEnabled || !slug || !ctx.business.storeWhatsapp) {
    return (
      <div className="space-y-6">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <EmptyState
          icon={QrCode}
          title="Primero publica tu tienda online"
          description="La carta es tu tienda online: tus productos con sus fotos y precios. Publícala con tu WhatsApp y vuelve aquí para imprimir los QR."
          action={
            can(ctx.role, "settings:manage") ? (
              <Button asChild>
                <Link href="/dashboard/configuracion?seccion=tienda">Publicar mi tienda</Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    )
  }

  const base = `${getAppUrl()}${storePath(slug)}`
  const tables = tableLabels(ctx.settings.tableCount, ctx.settings.tableExtras)
  const qr = (url: string) => QRCode.toDataURL(url, { margin: 1, width: 600, errorCorrectionLevel: "M" })
  const cards: QrCard[] = await Promise.all([
    { key: "carta", title: "Nuestra carta", subtitle: "Escanea para ver la carta", url: base },
    ...tables.map((t) => ({ key: t, title: t, subtitle: "Escanea para ver la carta y pedir", url: `${base}?mesa=${encodeURIComponent(t)}` })),
  ].map(async (c) => ({ ...c, qr: await qr(c.url) })))

  return (
    <div className="space-y-6">
      <PageHeader
        title={TITLE}
        description={DESCRIPTION}
        actions={
          can(ctx.role, "settings:manage") ? (
            <Button variant="outline" asChild>
              <Link href="/dashboard/configuracion?seccion=negocio#mesas">Cambiar mis mesas</Link>
            </Button>
          ) : null
        }
      />
      {tables.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no tienes mesas: por ahora solo está el QR general de la carta. Agrégalas en Configuración para tener uno por mesa.
        </p>
      ) : null}
      <QrSheet cards={cards} businessName={ctx.business.name} logoUrl={businessLogoUrl(ctx.businessId, ctx.business.logoUpdatedAt)} />
    </div>
  )
}
