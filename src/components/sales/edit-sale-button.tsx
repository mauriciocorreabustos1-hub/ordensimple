"use client"

import * as React from "react"
import { Pencil } from "lucide-react"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { AppModal } from "@/components/app/app-modal"
import { QuickSaleForm } from "@/components/sales/quick-sale-form"
import { SaleForm, type ProductOption } from "@/components/sales/sale-form"

export type EditableSale = {
  id: string
  isQuick: boolean
  total: number
  paymentMethod: PaymentMethod
  date: string
  customerName: string
  note: string
  lines: { productId: string | null; description: string; quantity: number; unitPrice: number }[]
}

export function EditSaleButton({
  sale,
  currency,
  timezone,
  products,
  customers,
}: {
  sale: EditableSale
  currency: string
  timezone: string
  products: ProductOption[]
  customers: string[]
}) {
  const [open, setOpen] = React.useState(false)
  const known = new Set(products.map((p) => p.id))
  // Si un producto ya no existe, la línea se edita como texto libre.
  const lines = sale.lines.map((l) => ({ ...l, productId: l.productId && known.has(l.productId) ? l.productId : null }))

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Editar venta" className="text-muted-foreground">
        <Pencil />
      </Button>
      <AppModal open={open} onOpenChange={setOpen} title="Editar venta">
        {open ? (
          sale.isQuick ? (
            <QuickSaleForm
              currency={currency}
              timezone={timezone}
              defaultPayment={sale.paymentMethod}
              customers={customers}
              editing={{
                id: sale.id,
                amount: sale.total,
                paymentMethod: sale.paymentMethod,
                date: sale.date,
                customerName: sale.customerName,
                note: sale.note,
              }}
              onDone={() => setOpen(false)}
            />
          ) : (
            <SaleForm
              currency={currency}
              timezone={timezone}
              defaultPayment={sale.paymentMethod}
              products={products}
              customers={customers}
              editing={{
                id: sale.id,
                lines,
                paymentMethod: sale.paymentMethod,
                date: sale.date,
                customerName: sale.customerName,
                note: sale.note,
              }}
              onDone={() => setOpen(false)}
            />
          )
        ) : null}
      </AppModal>
    </>
  )
}
