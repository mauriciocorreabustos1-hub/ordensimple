import type { Metadata } from "next"
import { Users } from "lucide-react"
import { ComingSoon } from "@/components/app/coming-soon"

export const metadata: Metadata = { title: "Clientes" }

export default function Page() {
  return (
    <ComingSoon
      title="Clientes"
      icon={Users}
      description="Conoce a quienes te compran y cuánto te compran."
      features={["Total comprado, número de compras y última compra", "Clientes frecuentes y clientes nuevos", "Los clientes que más te compran"]}
    />
  )
}
