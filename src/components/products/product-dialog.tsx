"use client"

import * as React from "react"
import { Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppModal } from "@/components/app/app-modal"
import { EMPTY_PRODUCT, ProductForm, type ProductFormValues } from "@/components/products/product-form"

export function ProductDialog({
  productId,
  initial,
  currency,
  categories,
}: {
  productId?: string
  initial?: ProductFormValues
  currency: string
  categories: string[]
}) {
  const [open, setOpen] = React.useState(false)
  const editing = Boolean(productId)
  return (
    <>
      {editing ? (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Editar producto">
          <Pencil />
        </Button>
      ) : (
        <Button size="lg" className="h-10 px-4" onClick={() => setOpen(true)}>
          <Plus />
          Nuevo producto
        </Button>
      )}
      <AppModal open={open} onOpenChange={setOpen} title={editing ? "Editar producto" : "Nuevo producto"}>
        {open ? (
          <ProductForm
            productId={productId}
            initial={initial ?? EMPTY_PRODUCT}
            currency={currency}
            categories={categories}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </AppModal>
    </>
  )
}
