import type { Metadata } from "next"
import { PageHeader } from "@/components/app/page-header"
import { ProGate } from "@/components/app/pro-gate"
import { QuotesBoard, type QuoteRow } from "@/components/quotes/quotes-board"
import { db } from "@/lib/db"
import { canUseFeature } from "@/lib/plans"
import type { QuoteItem } from "@/lib/quotes"
import { can } from "@/lib/roles"
import { productsOnly } from "@/server/sale-core"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Cotizaciones" }

const DAY_MS = 86_400_000

export default async function QuotesPage() {
  const ctx = await requireBusiness()
  if (!canUseFeature(ctx.business.plan, "quotes")) {
    return <ProGate title="Cotizaciones" description="Arma cotizaciones con tus productos, envíalas por WhatsApp y tu cliente las acepta desde un enlace." />
  }
  const [quotes, products, customers, settings] = await Promise.all([
    db.quote.findMany({ where: { businessId: ctx.businessId }, orderBy: { number: "desc" }, take: 300 }),
    db.product.findMany({ where: { businessId: ctx.businessId, active: true }, select: { id: true, name: true, price: true }, orderBy: { name: "asc" }, take: 2000 }),
    db.customer.findMany({ where: { businessId: ctx.businessId }, select: { id: true, name: true, phone: true, email: true }, orderBy: { name: "asc" }, take: 2000 }),
    db.businessSettings.findUnique({
      where: { businessId: ctx.businessId },
      select: { taxId: true, address: true, contactPhone: true, contactEmail: true, quoteTerms: true, quoteValidDays: true },
    }),
  ])

  const paid = new Map(
    (await db.onlinePayment.findMany({ where: { businessId: ctx.businessId, status: "APPROVED", quoteId: { in: quotes.map((q) => q.id) } }, select: { quoteId: true, method: true } })).map((p) => [p.quoteId, p.method ?? "mercadopago"]),
  )
  const rows: QuoteRow[] = quotes.map((q) => ({
    id: q.id,
    number: q.number,
    token: q.token,
    customerId: q.customerId,
    customerName: q.customerName,
    customerPhone: q.customerPhone,
    customerEmail: q.customerEmail,
    items: q.items as QuoteItem[],
    discount: q.discount,
    total: q.total,
    note: q.note,
    validUntil: q.validUntil.toISOString(),
    // Al editar se mantiene el mismo plazo que se le dio.
    validDays: Math.min(365, Math.max(1, Math.round((q.validUntil.getTime() - q.updatedAt.getTime()) / DAY_MS))),
    status: q.status,
    viewedAt: q.viewedAt?.toISOString() ?? null,
    respondedAt: q.respondedAt?.toISOString() ?? null,
    createdAt: q.createdAt.toISOString(),
    paidOnline: paid.get(q.id) ?? null,
  }))

  return (
    <div className="space-y-6">
      <PageHeader title="Cotizaciones" description="Envía cotizaciones con tus precios por WhatsApp. El cliente las revisa, las descarga en PDF y las acepta desde el enlace." />
      <QuotesBoard
        quotes={rows}
        products={products}
        customers={customers}
        info={settings ?? { taxId: null, address: null, contactPhone: null, contactEmail: null, quoteTerms: null, quoteValidDays: 15 }}
        currency={ctx.currency}
        timezone={ctx.timezone}
        businessName={ctx.business.name}
        defaultPayment={ctx.settings.defaultPayment}
        productsOnly={productsOnly(ctx)}
        canDelete={can(ctx.role, "sales:delete")}
        canEditInfo={can(ctx.role, "settings:manage")}
      />
    </div>
  )
}
