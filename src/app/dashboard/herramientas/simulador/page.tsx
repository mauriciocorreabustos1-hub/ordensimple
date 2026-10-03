import type { Metadata } from "next"
import { Simulator } from "@/components/tools/simulator"
import { ToolShell } from "@/components/tools/tool-shell"
import { getBaseline } from "@/server/queries/baseline"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "¿Qué pasa si...?" }

export default async function SimulatorPage() {
  const ctx = await requireBusiness()
  const baseline = await getBaseline(ctx.businessId, ctx.timezone)

  // Si no hay costo de lo vendido ni compras registradas, lo estimamos con el margen promedio del catálogo.
  const variableCosts =
    baseline.variableCosts > 0
      ? baseline.variableCosts
      : baseline.marginPct !== null
        ? Math.round(baseline.sales * (1 - baseline.marginPct / 100))
        : 0

  return (
    <ToolShell
      title="¿Qué pasa si...?"
      description="Simula cambios en tu negocio y mira cómo afectarían tu ganancia. No se modifica ningún dato real."
    >
      <Simulator
        currency={ctx.currency}
        fromData={baseline.hasData}
        base={{ sales: baseline.sales, variableCosts, fixedCosts: baseline.fixedCosts }}
      />
    </ToolShell>
  )
}
