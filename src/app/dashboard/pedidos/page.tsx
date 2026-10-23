import type { Metadata } from "next"
import Link from "next/link"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { WebOrdersList, type WebOrderRow } from "@/components/store/web-orders-list"
import { db } from "@/lib/db"
import { isFoodBusiness } from "@/lib/business-kind"
import { canUseFeature } from "@/lib/plans"
import { can } from "@/lib/roles"
import { storePath } from "@/lib/store"
import { addDays } from "@/lib/dates"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Pedidos web" }

const DESCRIPTION = "Los pedidos que te hacen desde tu tienda online. Confírmalos por WhatsApp y regístralos aquí con un toque."

export default async function WebOrdersPage() {
  const ctx = await requireBusiness()
  if (!canUseFeature(ctx.business.plan, "store")) {
    return <ProGate title="Tienda online" description="Publica tus productos con precio y recibe pedidos por WhatsApp." />
  }
  const canSetup = can(ctx.role, "settings:manage")
  if (!ctx.business.storeSlug) {
    return (
      <div className="space-y-6">
        <PageHeader title="Pedidos web" description={DESCRIPTION} />
        <EmptyState
          icon={Globe}
          title="Todavía no publicas tu tienda"
          description="Activa tu tienda online en Configuración: tus clientes verán tus productos y te harán pedidos por WhatsApp."
          action={
            canSetup ? (
              <Button asChild>
                <Link href="/dashboard/configuracion?seccion=tienda">Crear mi tienda</Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    )
  }

  const since = addDays(new Date(), -7, ctx.timezone)
  const orders = await db.webOrder.findMany({
    where: { businessId: ctx.businessId, OR: [{ status: "NEW" }, { createdAt: { gte: since } }] },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  const rows: WebOrderRow[] = orders.map((o) => ({
    id: o.id,
    code: o.id.slice(-5).toUpperCase(),
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    delivery: o.delivery,
    note: o.note,
    items: o.items as WebOrderRow["items"],
    total: o.total,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    asComanda: Boolean(o.comandaId),
    promoDiscount: o.promoDiscount,
    couponCode: o.couponCode,
    couponDiscount: o.couponDiscount,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos web"
        description={DESCRIPTION}
        actions={
          <Button variant="outline" asChild>
            <a href={storePath(ctx.business.storeSlug)} target="_blank" rel="noopener noreferrer">
              <Globe />
              Ver mi tienda
            </a>
          </Button>
        }
      />
      {!ctx.business.storeEnabled ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          Tu tienda está apagada: nadie puede hacer pedidos.{" "}
          {canSetup ? (
            <Link href="/dashboard/configuracion?seccion=tienda" className="font-medium underline">
              Actívala en Configuración
            </Link>
          ) : null}
        </p>
      ) : null}
      <WebOrdersList
        canDelete={can(ctx.role, "sales:delete")}
        orders={rows}
        currency={ctx.currency}
        timezone={ctx.timezone}
        canComanda={isFoodBusiness(ctx.business.type) && canUseFeature(ctx.business.plan, "comandas")}
        defaultPayment={ctx.settings.defaultPayment}
        businessName={ctx.business.name}
      />
    </div>
  )
}
