import type { Metadata } from "next"
import Link from "next/link"
import { ChefHat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { KitchenBoard } from "@/components/comandas/kitchen-board"
import { db } from "@/lib/db"
import { isFoodBusiness } from "@/lib/business-kind"
import { canUseFeature } from "@/lib/plans"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Cocina" }

const TITLE = "Cocina"
const DESCRIPTION = "Lo que falta preparar de cada mesa o pedido. Toca un plato cuando esté listo y el garzón lo verá en Comandas."

export default async function KitchenPage() {
  const ctx = await requireBusiness()
  if (!isFoodBusiness(ctx.business.type)) {
    return (
      <div className="space-y-6">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <EmptyState
          icon={ChefHat}
          title="La cocina es para restaurantes, cafés y negocios de comida"
          description="Si tu negocio es de comida, márcalo en Configuración (rubro “Restaurante, café o comida”) y aparecerá aquí."
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard/configuracion">Ir a Configuración</Link>
            </Button>
          }
        />
      </div>
    )
  }
  if (!canUseFeature(ctx.business.plan, "comandas")) {
    return <ProGate title={TITLE} description={DESCRIPTION} />
  }

  const open = await db.comanda.findMany({
    where: { businessId: ctx.businessId, status: "OPEN" },
    include: { items: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  })
  // Solo lo que falta preparar; las mesas que tienen todo listo no se muestran.
  const tickets = open
    .map((c) => {
      const items = c.items
        .filter((i) => i.sentQty > i.readyQty)
        .map((i) => ({ id: i.id, description: i.description, quantity: i.sentQty - i.readyQty, note: i.note ?? "", person: i.person, since: (i.sentAt ?? i.updatedAt).toISOString() }))
      const since = items.reduce((min, i) => (i.since < min ? i.since : min), items[0]?.since ?? c.createdAt.toISOString())
      return { id: c.id, label: c.label, since, items }
    })
    .filter((t) => t.items.length > 0)
    .sort((a, b) => a.since.localeCompare(b.since))

  return (
    <div className="space-y-6">
      <PageHeader title={TITLE} description={DESCRIPTION} />
      <KitchenBoard tickets={tickets} />
    </div>
  )
}
