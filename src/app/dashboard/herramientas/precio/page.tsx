import type { Metadata } from "next"
import { PriceCalculator } from "@/components/tools/price-calculator"
import { ToolShell } from "@/components/tools/tool-shell"
import { requireBusiness } from "@/server/session"

export const metadata: Metadata = { title: "¿A cuánto debería vender?" }

export default async function PriceToolPage() {
  const ctx = await requireBusiness()
  return (
    <ToolShell
      title="¿A cuánto debería vender?"
      description="Dinos cuánto te cuesta y cuánto quieres ganar. Te sugerimos el precio."
    >
      <PriceCalculator currency={ctx.currency} />
    </ToolShell>
  )
}
