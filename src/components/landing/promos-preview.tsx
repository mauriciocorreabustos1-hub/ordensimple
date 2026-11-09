import { Ticket } from "lucide-react"
import { cn } from "@/lib/utils"

// Dibujo de las promociones: la venta con el 2×1 aplicado solo, un happy hour y un cupón (datos de ejemplo).

export function PromosPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[34rem]", className)} aria-hidden>
      {/* Etiquetas de las promociones activas, sobre la esquina de la venta */}
      <div className="relative z-20 -mb-5 flex w-[92%] justify-end gap-2 pr-1 sm:w-[84%]">
        <span className="rounded-xl bg-deep px-3 py-1.5 text-base font-bold text-white shadow-lg">2×1</span>
        <span className="rounded-xl bg-primary px-3 py-1.5 text-base font-bold text-primary-foreground shadow-lg">−20 %</span>
      </div>

      {/* La venta con la promoción aplicada sola */}
      <div className="relative z-10 w-[92%] rounded-2xl border bg-card p-4 shadow-xl sm:w-[84%] sm:p-5">
        <p className="font-display text-lg font-semibold">Venta</p>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex justify-between">
            <span>2 × Completo italiano</span>
            <span className="tabular">$7.000</span>
          </li>
          <li className="flex justify-between">
            <span>2 × Bebida 350 cc</span>
            <span className="tabular">$2.400</span>
          </li>
          <li className="flex justify-between font-medium text-emerald-700 dark:text-emerald-400">
            <span>🏷️ 2×1 en bebidas</span>
            <span className="tabular">−$1.200</span>
          </li>
          <li className="flex justify-between font-medium text-emerald-700 dark:text-emerald-400">
            <span>🏷️ Happy hour −20 %</span>
            <span className="tabular">−$1.400</span>
          </li>
        </ul>
        <div className="mt-3 flex items-baseline justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="tabular text-xl font-semibold">
            $6.800 <span className="text-sm font-normal text-muted-foreground line-through">$9.400</span>
          </span>
        </div>
      </div>

      {/* Cupón de la tienda online */}
      <div className="relative z-20 -mt-4 ml-auto w-[64%] rounded-2xl border-2 border-dashed border-primary/50 bg-card p-3 shadow-2xl sm:w-[50%]">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Ticket className="size-3.5" />
          Cupón de tu tienda online
        </p>
        <p className="mt-1 font-mono text-lg font-bold tracking-wider">BIENVENIDO10</p>
        <p className="text-xs text-muted-foreground">10 % en tu primera compra</p>
      </div>
    </div>
  )
}
