import type { Metadata } from "next"
import Link from "next/link"
import { ClipboardList, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { ComandasBoard } from "@/components/comandas/comandas-board"
import { activePromotions } from "@/server/sale-core"
import { db } from "@/lib/db"
import { isFoodBusiness, tableLabels } from "@/lib/business-kind"
import { can, canApproveDiscounts } from "@/lib/roles"
import { formatMoney } from "@/lib/currency"
import { startOfDay } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Comandas" }

const TITLE = "Comandas"
const DESCRIPTION = "Abre una cuenta por mesa o pedido, ve sumando lo que piden y cóbrala al final. Al cobrar queda como venta."

export default async function ComandasPage() {
  const ctx = await requireBusiness()
  if (!isFoodBusiness(ctx.business.type)) {
    return (
      <div className="space-y-6">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <EmptyState
          icon={ClipboardList}
          title="Las comandas son para restaurantes, cafés y negocios de comida"
          description="Si tu negocio es de comida, márcalo en Configuración (rubro “Restaurante, café o comida”) y aparecerán aquí."
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

  const dayStart = startOfDay(new Date(), ctx.timezone)
  const [open, products, customers, paidToday] = await Promise.all([
    db.comanda.findMany({
      where: { businessId: ctx.businessId, status: "OPEN" },
      include: { items: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    db.product.findMany({
      where: { businessId: ctx.businessId, active: true },
      select: { id: true, name: true, price: true, imageUrl: true, categoryId: true, category: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 500,
    }),
    db.customer.findMany({ where: { businessId: ctx.businessId }, select: { name: true }, orderBy: { name: "asc" }, take: 500 }),
    db.comanda.findMany({
      where: { businessId: ctx.businessId, status: "PAID", closedAt: { gte: dayStart } },
      select: { sale: { select: { total: true } } },
    }),
  ])
  const paidTotal = paidToday.reduce((sum, c) => sum + (c.sale?.total ?? 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={TITLE}
        description={
          paidToday.length
            ? `Hoy cobraste ${paidToday.length} comanda${paidToday.length === 1 ? "" : "s"} por ${formatMoney(paidTotal, ctx.currency)}.`
            : DESCRIPTION
        }
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/comandas/carta-qr">
              <QrCode />
              Carta con QR
            </Link>
          </Button>
        }
      />
      <ComandasBoard
        currency={ctx.currency}
        defaultPayment={ctx.settings.defaultPayment}
        comandas={open.map((c) => ({
          id: c.id,
          label: c.label,
          createdAt: c.createdAt.toISOString(),
          items: c.items.map((i) => ({
            id: i.id,
            readyQty: i.readyQty,
            paidQty: i.paidQty,
            sentQty: i.sentQty,
            productId: i.productId,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            note: i.note ?? "",
            person: i.person,
          })),
        }))}
        products={products.map((p) => ({ id: p.id, name: p.name, price: p.price, category: p.category?.name ?? null, categoryId: p.categoryId, imageUrl: p.imageUrl }))}
        promotions={await activePromotions(ctx.businessId, ctx.business.plan)}
        timezone={ctx.timezone}
        businessName={ctx.business.name}
        customers={customers.map((c) => c.name)}
        tables={tableLabels(ctx.settings.tableCount, ctx.settings.tableExtras)}
        canEditTables={can(ctx.role, "settings:manage")}
        canApproveDiscounts={canApproveDiscounts(ctx.role)}
        productsOnly={!canApproveDiscounts(ctx.role) && ctx.settings.employeesProductsOnly}
      />
    </div>
  )
}
