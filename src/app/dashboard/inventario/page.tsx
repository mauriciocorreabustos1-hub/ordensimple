import type { Metadata } from "next"
import { Boxes } from "lucide-react"
import { ComingSoon } from "@/components/app/coming-soon"

export const metadata: Metadata = { title: "Inventario" }

export default function Page() {
  return (
    <ComingSoon
      title="Inventario"
      icon={Boxes}
      description="Controla tu stock, recibe alertas y registra entradas, salidas y ajustes."
      features={["Stock actual, bajo y agotado de un vistazo", "Alertas como: Te quedan 4 unidades de Coca-Cola 1.5L", "Entradas, salidas y ajustes de mercadería", "Productos más vendidos y dinero inmovilizado"]}
    />
  )
}
