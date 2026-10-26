import type { Metadata } from "next"
import { CreditCard } from "lucide-react"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { PaymentsBoard } from "@/components/payments/payments-board"
import { db } from "@/lib/db"
import { can } from "@/lib/roles"
import { onlinePaymentsAvailable } from "@/server/mp-marketplace"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Cobros online" }

const DESCRIPTION = "Tus clientes te pagan con tarjeta o Mercado Pago en tu tienda, tus cotizaciones o con un enlace, y el dinero llega a tu cuenta."

export default async function OnlinePaymentsPage({ searchParams }: PageProps<"/dashboard/cobros">) {
  const ctx = await requireBusiness()
  const sp = await searchParams
  if (!onlinePaymentsAvailable()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cobros online" description={DESCRIPTION} />
        <EmptyState icon={CreditCard} title="Muy pronto" description="Estamos terminando de habilitar los pagos con Mercado Pago. Te avisaremos apenas puedas conectarlo." />
      </div>
    )
  }
  const [account, payments, links] = await Promise.all([
    db.mercadoPagoAccount.findUnique({ where: { businessId: ctx.businessId }, select: { storeEnabled: true, storePayRule: true } }),
    db.onlinePayment.findMany({
      where: { businessId: ctx.businessId, status: { not: "PENDING" } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, description: true, amount: true, fee: true, status: true, method: true, createdAt: true, paidAt: true },
    }),
    db.paymentLink.findMany({ where: { businessId: ctx.businessId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ])
  const notice = sp.conectado ? "conectado" : sp.error === "permiso" ? "permiso" : sp.error ? "error" : null

  return (
    <div className="space-y-6">
      <PageHeader title="Cobros online" description={DESCRIPTION} />
      <PaymentsBoard
        connected={Boolean(account)}
        storeMode={account?.storeEnabled ? account.storePayRule : "OFF"}
        canManage={can(ctx.role, "settings:manage")}
        payments={payments.map((p) => ({ ...p, createdAt: p.createdAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null }))}
        links={links.map((l) => ({ id: l.id, token: l.token, title: l.title, amount: l.amount, customerName: l.customerName, customerPhone: l.customerPhone, status: l.status, createdAt: l.createdAt.toISOString() }))}
        currency={ctx.currency}
        timezone={ctx.timezone}
        businessName={ctx.business.name}
        notice={notice}
      />
    </div>
  )
}
