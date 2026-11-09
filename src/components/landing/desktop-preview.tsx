import { Boxes, Check, ChefHat, Home, Monitor, NotebookPen, ShoppingBag, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

// Dibujo de OrdenSimple para PC: la ventana con todo el negocio y el comprobante que sale solo en la impresora (datos de ejemplo).

const MENU = [
  { icon: Home, label: "Inicio" },
  { icon: ShoppingBag, label: "Ventas", active: true },
  { icon: Boxes, label: "Inventario" },
  { icon: Wallet, label: "Caja" },
  { icon: NotebookPen, label: "Fiado" },
  { icon: ChefHat, label: "Comandas" },
]

const ITEMS = [
  { qty: 2, name: "Pan amasado (kg)", price: "$4.800" },
  { qty: 1, name: "Leche entera 1L", price: "$1.290" },
  { qty: 1, name: "Café en grano 250 g", price: "$5.990" },
]

export function DesktopPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[34rem]", className)} aria-hidden>
      {/* Ventana de la app en el PC */}
      <div className="relative z-10 w-[94%] overflow-hidden rounded-2xl border bg-card shadow-xl sm:w-[88%]">
        <div className="flex items-center gap-2 border-b bg-muted/60 px-3 py-2">
          <span className="flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Monitor className="size-3" />
          </span>
          <span className="text-xs font-semibold">OrdenSimple</span>
          <span className="ml-auto flex gap-1.5">
            <span className="size-2.5 rounded-full bg-muted-foreground/30" />
            <span className="size-2.5 rounded-full bg-muted-foreground/30" />
            <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          </span>
        </div>
        <div className="flex">
          <div className="w-[38%] space-y-0.5 border-r p-2">
            {MENU.map((m) => (
              <div key={m.label} className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px]", m.active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground")}>
                <m.icon className="size-3.5 shrink-0" />
                {m.label}
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-2.5 p-3">
            <div className="rounded-lg border p-2.5">
              <p className="text-[10px] text-muted-foreground">Vendiste hoy</p>
              <p className="tabular text-lg font-semibold">$228.080</p>
            </div>
            <div className="space-y-1 text-[11px]">
              {ITEMS.map((i) => (
                <div key={i.name} className="flex justify-between gap-2">
                  <span className="truncate">
                    {i.qty} × {i.name}
                  </span>
                  <span className="tabular shrink-0">{i.price}</span>
                </div>
              ))}
            </div>
            <span className="inline-block rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">Registrar venta</span>
          </div>
        </div>
      </div>

      {/* El comprobante que sale solo */}
      <div className="relative z-20 mt-4 ml-auto w-[66%] sm:mt-2 sm:w-[50%]">
        {/* Etiqueta pegada al borde de arriba del comprobante */}
        <p className="absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold whitespace-nowrap text-primary-foreground shadow-md">
          <Check className="size-3.5" />
          Comprobante impreso al instante
        </p>
        <div className="rounded-b-md border border-neutral-200 bg-white p-3 pt-5 font-mono text-[10.5px] leading-snug text-black shadow-2xl">
          <p className="text-center font-bold">ALMACEN DON PEDRO</p>
          <p className="text-center text-[10px]">Venta 13:42</p>
          <p className="my-1 overflow-hidden whitespace-nowrap">--------------------------------</p>
          {ITEMS.map((i) => (
            <p key={i.name} className="flex justify-between gap-2">
              <span className="truncate">
                {i.qty} x {i.name}
              </span>
              <span>{i.price}</span>
            </p>
          ))}
          <p className="my-1 overflow-hidden whitespace-nowrap">--------------------------------</p>
          <p className="flex justify-between font-bold">
            <span>TOTAL</span>
            <span>$12.080</span>
          </p>
        </div>
      </div>
    </div>
  )
}
