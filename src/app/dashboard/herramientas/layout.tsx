import { ProGate } from "@/components/app/pro-gate"
import { canUseFeature } from "@/lib/plans"
import { requireBusiness, requirePermission } from "@/server/session"

// Las calculadoras trabajan con costos y ganancias: solo para el dueño y administradores.
export default async function ToolsLayout({ children }: LayoutProps<"/dashboard/herramientas">) {
  const ctx = await requireBusiness()
  requirePermission(ctx, "finances:view")
  if (!canUseFeature(ctx.business.plan, "tools")) {
    return <ProGate title="Herramientas" description="Calculadoras que usan tus números: precio de venta, punto de equilibrio, metas y simulador." />
  }
  return children
}
