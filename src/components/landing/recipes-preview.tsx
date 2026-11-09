import { CalendarClock } from "lucide-react"
import { cn } from "@/lib/utils"

// Dibujo de las recetas: el costo de cada ingrediente, el precio sugerido y un material por vencer (datos de ejemplo).

const INGREDIENTS = [
  { name: "Harina", qty: "1 kg", cost: "$1.000" },
  { name: "Levadura", qty: "28 g", cost: "$106" },
  { name: "Aceite", qty: "200 ml", cost: "$398" },
  { name: "Sal y azúcar", qty: "15 g", cost: "$15" },
]

export function RecipesPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[34rem]", className)} aria-hidden>
      {/* La receta con el costo de cada ingrediente */}
      <div className="relative z-10 w-[92%] rounded-2xl border bg-card p-4 shadow-xl sm:w-[84%] sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-lg font-semibold">Pan amasado</p>
          <span className="text-xs text-muted-foreground">rinde 20 unidades</span>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {INGREDIENTS.map((i) => (
            <li key={i.name} className="flex justify-between gap-3">
              <span>
                {i.name} <span className="text-muted-foreground">· {i.qty}</span>
              </span>
              <span className="tabular">{i.cost}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Costo por unidad</span>
            <span className="tabular">$76</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-medium">Precio sugerido</span>
            <span className="tabular text-xl font-semibold text-primary">$190</span>
          </div>
        </div>
      </div>

      {/* Stock de un material, con su vencimiento */}
      <div className="relative z-20 -mt-4 ml-auto w-[70%] rounded-2xl border bg-card p-3 shadow-2xl sm:w-[56%]">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <CalendarClock className="size-3.5" />
          Vence en 5 días
        </p>
        <p className="mt-1 text-sm font-medium">Levadura fresca</p>
        <p className="text-xs text-muted-foreground">Quedan 450 g · alcanza para 16 tandas</p>
      </div>
    </div>
  )
}
