import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/app/page-header"
import { LabelsBuilder } from "@/components/products/labels-builder"
import { db } from "@/lib/db"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "Etiquetas con código de barras" }

export default async function LabelsPage() {
  const ctx = await requireBusiness()
  requirePermission(ctx, "products:manage")
  const products = await db.product.findMany({
    where: { businessId: ctx.businessId, active: true, isService: false },
    select: { id: true, name: true, price: true, sku: true, stock: true, trackStock: true, category: { select: { name: true } } },
    orderBy: { name: "asc" },
  })
  return (
    <div className="space-y-6">
      <PageHeader
        title="Etiquetas con código de barras"
        description="Imprime etiquetas con nombre, precio y código para pegar en tus productos y venderlos escaneando. Sirven hojas de stickers A4 o una impresora de etiquetas."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/productos">
              <ChevronLeft />
              Volver a Productos
            </Link>
          </Button>
        }
      />
      <LabelsBuilder
        currency={ctx.currency}
        businessName={ctx.business.name}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          sku: p.sku || null,
          stock: p.trackStock ? p.stock : null,
          category: p.category?.name ?? null,
        }))}
      />
    </div>
  )
}
