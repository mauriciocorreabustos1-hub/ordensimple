import type { Metadata } from "next"
import { PageHeader } from "@/components/app/page-header"
import { RecipesBoard } from "@/components/recipes/recipes-board"
import { db } from "@/lib/db"
import { toDateKey } from "@/lib/dates"
import { requireBusiness, requirePermission } from "@/server/session"

export const metadata: Metadata = { title: "Recetas" }

export default async function RecipesPage({ searchParams }: PageProps<"/dashboard/recetas">) {
  const ctx = await requireBusiness()
  requirePermission(ctx, "products:manage")
  const params = await searchParams
  const [materials, recipes, products] = await Promise.all([
    db.recipeMaterial.findMany({
      where: { businessId: ctx.businessId },
      select: { id: true, name: true, unit: true, packQty: true, packPrice: true, stock: true, expiresAt: true },
      orderBy: { name: "asc" },
    }),
    db.recipe.findMany({
      where: { businessId: ctx.businessId },
      include: { items: { select: { materialId: true, quantity: true, unit: true } }, product: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({
      where: { businessId: ctx.businessId, active: true, isService: false },
      select: { id: true, name: true, price: true },
      orderBy: { name: "asc" },
      take: 1000,
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recetas"
        description="Anota lo que compras y tus recetas: te decimos cuánto te cuesta cada una y a cuánto vender cada unidad. Gratis en todos los planes."
      />
      <RecipesBoard
        currency={ctx.currency}
        initialTab={params.pestana === "materiales" ? "materiales" : "recetas"}
        today={toDateKey(new Date(), ctx.timezone)}
        materials={materials.map((m) => ({ ...m, expiresAt: m.expiresAt ? toDateKey(m.expiresAt, ctx.timezone) : null }))}
        recipes={recipes.map((r) => ({
          id: r.id,
          name: r.name,
          yieldUnits: r.yieldUnits,
          overheadPct: r.overheadPct,
          profitPct: r.profitPct,
          productId: r.productId,
          productName: r.product?.name ?? null,
          items: r.items,
        }))}
        products={products}
      />
    </div>
  )
}
