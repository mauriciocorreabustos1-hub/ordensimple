import type { Metadata } from "next"
import { BreakEvenCalculator } from "@/components/tools/break-even-calculator"
import { ToolShell } from "@/components/tools/tool-shell"
import { getBaseline } from "@/server/queries/baseline"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "Punto de equilibrio" }

export default async function BreakEvenPage() {
  const ctx = await requireBusiness()
  const baseline = await getBaseline(ctx.businessId, ctx.timezone)
  return (
    <ToolShell
      title="¿Cuánto necesito vender para no perder?"
      description="Calcula tu punto de equilibrio: lo mínimo que tienes que vender para cubrir todos tus gastos."
    >
      <BreakEvenCalculator
        currency={ctx.currency}
        defaults={{
          fixedCosts: baseline.fixedCosts,
          unitCost: baseline.avgCost,
          price: baseline.avgPrice,
          fromData: baseline.fixedCosts > 0,
        }}
      />
    </ToolShell>
  )
}
