import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"
import { ProductImport } from "@/components/products/product-import"
import { db } from "@/lib/db"
import { productLimit } from "@/lib/plans"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "Importar productos" }

export default async function ImportProductsPage() {
  const ctx = await requireBusiness()
  requirePermission(ctx, "products:manage")
  const limit = productLimit(ctx.business.plan, ctx.business.extraProducts)
  const current = limit === null ? 0 : await db.product.count({ where: { businessId: ctx.businessId } })
  return (
    <div className="space-y-6">
      <Link href="/dashboard/productos" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Productos
      </Link>
      <PageHeader title="Importar productos" description="Carga todo tu catálogo desde un Excel o CSV. Revisas cada fila antes de guardar." />
      <ProductImport currency={ctx.currency} limit={limit} current={current} />
    </div>
  )
}
