import type { Metadata } from "next"
import { Truck } from "lucide-react"
import { ComingSoon } from "@/components/app/coming-soon"

export const metadata: Metadata = { title: "Proveedores" }

export default function Page() {
  return (
    <ComingSoon
      title="Proveedores"
      icon={Truck}
      description="Ordena a tus proveedores y descubre cuál te conviene más."
      features={["Contactos, productos y costos de despacho", "Última compra a cada proveedor", "Comparador: cuál conviene según la cantidad que compras"]}
    />
  )
}
