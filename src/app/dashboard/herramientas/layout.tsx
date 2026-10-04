import { requireBusiness, requirePermission } from "@/server/session"

// Las calculadoras trabajan con costos y ganancias: solo para el dueño y administradores.
export default async function ToolsLayout({ children }: LayoutProps<"/dashboard/herramientas">) {
  const ctx = await requireBusiness()
  requirePermission(ctx, "finances:view")
  return children
}
