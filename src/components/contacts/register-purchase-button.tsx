"use client"

import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQuickActions } from "@/components/app/quick-actions"

/** En la ficha del proveedor: abre "Registrar gasto" como compra a ese proveedor. */
export function RegisterPurchaseButton({ supplierName }: { supplierName: string }) {
  const { open } = useQuickActions()
  return (
    <Button onClick={() => open("expense", { supplierName })}>
      <ShoppingCart />
      Registrar compra
    </Button>
  )
}
