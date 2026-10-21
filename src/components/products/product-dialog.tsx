"use client"

import * as React from "react"
import { Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppModal } from "@/components/app/app-modal"
import { EMPTY_PRODUCT, EMPTY_SERVICE, ProductForm, type ProductFormValues } from "@/components/products/product-form"

export function ProductDialog({
  productId,
  initial,
  currency,
  categories,
  kind = "product",
}: {
  productId?: string
  initial?: ProductFormValues
  currency: string
  categories: string[]
  /** "service": parte sin stock y con duración (negocios de servicios). */
  kind?: "product" | "service"
}) {
  const word = kind === "service" ? "servicio" : "producto"
  const [open, setOpen] = React.useState(false)
  const editing = Boolean(productId)
  return (
    <>
      {editing ? (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={`Editar ${word}`}>
          <Pencil />
        </Button>
      ) : (
        <Button size="lg" className="h-10 px-4" onClick={() => setOpen(true)}>
          <Plus />
          Nuevo {word}
        </Button>
      )}
      <AppModal open={open} onOpenChange={setOpen} title={editing ? `Editar ${word}` : `Nuevo ${word}`}>
        {open ? (
          <ProductForm
            productId={productId}
            initial={initial ?? (kind === "service" ? EMPTY_SERVICE : EMPTY_PRODUCT)}
            currency={currency}
            categories={categories}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </AppModal>
    </>
  )
}
