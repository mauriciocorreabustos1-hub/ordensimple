import type { Metadata } from "next"
import { BarChart3 } from "lucide-react"
import { ComingSoon } from "@/components/app/coming-soon"

export const metadata: Metadata = { title: "Reportes" }

export default function Page() {
  return (
    <ComingSoon
      title="Reportes"
      icon={BarChart3}
      description="Resúmenes claros de cómo le va a tu negocio."
      features={["Resumen semanal y mensual", "Productos más vendidos y más rentables", "Gastos por categoría y comparaciones", "Exportar a PDF y Excel"]}
    />
  )
}
