import { Minus, Plus, Search, ShoppingBasket } from "lucide-react"
import { WhatsAppIcon } from "@/components/landing/social-links"
import { cn } from "@/lib/utils"

// Dibujo de la tienda online y del pedido que llega por WhatsApp (datos de ejemplo).

const PRODUCTS = [
  { name: "Pan amasado (kg)", price: "$2.400", qty: 2, photo: "🍞", tone: "bg-amber-100" },
  { name: "Queso gauda 250g", price: "$3.290", qty: 1, photo: "🧀", tone: "bg-yellow-100" },
  { name: "Huevos (docena)", price: "$3.990", qty: 0, photo: "🥚", tone: "bg-orange-50" },
  { name: "Café de grano 250g", price: "$5.990", qty: 0, photo: "☕", tone: "bg-stone-200" },
]

export function StorePreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[34rem]", className)} aria-hidden>
      {/* La tienda en el celular del cliente */}
      <div className="relative z-10 w-[80%] -rotate-1 overflow-hidden rounded-[1.75rem] border-4 border-foreground/90 bg-muted/40 shadow-xl sm:w-[66%]">
        <div className="flex items-center gap-2.5 border-b bg-card px-3.5 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">AD</span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">Almacén Don Pedro</p>
            <p className="truncate text-[11px] text-muted-foreground">Despacho en Maipú · Pagas al recibir</p>
          </div>
        </div>
        <div className="space-y-2 p-2.5">
          <div className="flex h-8 items-center gap-2 rounded-lg border bg-card px-2.5 text-xs text-muted-foreground">
            <Search className="size-3.5" />
            Buscar productos
          </div>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card text-[13px]">
            {PRODUCTS.map((p) => (
              <li key={p.name} className="flex items-center gap-2 px-2.5 py-2">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-lg ${p.tone}`}>{p.photo}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  {p.name}
                  <span className="tabular block text-[11px] text-muted-foreground">{p.price}</span>
                </span>
                {p.qty ? (
                  <span className="flex items-center rounded-md border">
                    <Minus className="m-1 size-3" />
                    <span className="tabular w-4 text-center text-xs font-semibold">{p.qty}</span>
                    <Plus className="m-1 size-3" />
                  </span>
                ) : (
                  <span className="rounded-md border px-2 py-0.5 text-[11px] font-medium">+ Agregar</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2 border-t bg-card px-3 py-2.5">
          <span className="tabular mr-auto text-sm font-semibold">$8.090</span>
          <span className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground">
            <ShoppingBasket className="size-3.5" />
            Hacer pedido
          </span>
        </div>
      </div>

      {/* El pedido que le llega al negocio por WhatsApp */}
      <div className="relative z-20 -mt-16 ml-auto w-[74%] rotate-1 rounded-2xl border bg-[#e7f8ee] p-3 text-[12.5px] leading-snug text-[#10291c] shadow-2xl sm:-mt-24 sm:w-[56%] dark:bg-[#123824] dark:text-[#dff5e8]">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#128c4a] dark:text-[#4ade80]">
          <WhatsAppIcon className="size-3.5" />
          Nuevo mensaje
        </p>
        <p className="font-semibold">🛒 Nuevo pedido n.º 7KQ2M</p>
        <p className="mt-1">▪️ 2 × Pan amasado (kg) — $4.800</p>
        <p>▪️ 1 × Queso gauda 250g — $3.290</p>
        <p className="mt-1 font-semibold">💰 Total: $8.090</p>
        <p>🛵 Despacho · 📍 Av. Pajaritos 1234</p>
        <p>👤 María González</p>
      </div>
    </div>
  )
}
