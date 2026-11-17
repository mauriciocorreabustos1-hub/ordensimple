import { BusinessLogo } from "@/components/app/business-logo"
import { StoreFront } from "@/components/store/store-front"
import { db } from "@/lib/db"

/**
 * Vista previa de la tienda online con los productos reales del negocio, dentro de un teléfono. Se puede mirar en
 * cualquier plan: lo que es del plan Pro es publicarla (su dirección propia) y recibir pedidos.
 */
export async function StorePreview({
  business,
}: {
  business: { id: string; name: string; currency: string; timezone: string; storeMessage: string | null; logoUpdatedAt: Date | null }
}) {
  const products = await db.product.findMany({
    where: { businessId: business.id, active: true, price: { gt: 0 }, isService: false, OR: [{ trackStock: false }, { stock: { gt: 0 } }] },
    select: { id: true, name: true, description: true, price: true, stock: true, trackStock: true, imageUrl: true, categoryId: true, category: { select: { name: true } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    take: 60,
  })

  return (
    <div className="mx-auto w-full max-w-[380px]">
      {/* El transform hace que la barra del carro (fixed) quede dentro del teléfono y no sobre la página. */}
      <div className="overflow-hidden rounded-[2.25rem] border-[10px] border-foreground/85 bg-background shadow-xl [transform:translateZ(0)]">
        <div className="h-[600px] overflow-y-auto bg-muted/30" aria-label="Vista previa de tu tienda online">
          <header className="border-b bg-background">
            <div className="flex items-center gap-3 px-4 py-4">
              <BusinessLogo businessId={business.id} name={business.name} logoUpdatedAt={business.logoUpdatedAt} className="size-11 rounded-xl border" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight">{business.name}</p>
                <p className="text-xs text-muted-foreground">{business.storeMessage || "Elige tus productos y envía tu pedido por WhatsApp."}</p>
              </div>
            </div>
          </header>
          <div className="space-y-6 px-4 pt-4 pb-28">
            {products.length ? (
              <StoreFront
                preview
                slug={`vista-previa-${business.id}`}
                businessName={business.name}
                currency={business.currency}
                timezone={business.timezone}
                products={products.map((p) => ({
                  id: p.id,
                  name: p.name,
                  price: p.price,
                  category: p.category?.name ?? null,
                  max: p.trackStock ? Math.min(99, p.stock) : 99,
                  imageUrl: p.imageUrl,
                  categoryId: p.categoryId,
                  description: p.description,
                }))}
              />
            ) : (
              <p className="rounded-xl border border-dashed bg-background p-4 text-center text-sm text-muted-foreground">
                Aquí aparecerán tus productos con precio y stock. Agrégalos en Productos para ver cómo queda tu tienda.
              </p>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">Vista previa con tus productos. Puedes probar el carro; no se envían pedidos.</p>
    </div>
  )
}
