import { Check, ChefHat } from "lucide-react"
import { cn } from "@/lib/utils"

// Dibujo de cómo se ven las comandas y la cocina dentro de la app (datos de ejemplo).

const ORDER = [
  { qty: 2, name: "Completo italiano", note: "sin mayo", price: "$7.000", state: "cocina" },
  { qty: 1, name: "Churrasco palta", note: "", price: "$6.490", state: "cocina" },
  { qty: 2, name: "Bebida 350 cc", note: "", price: "$2.400", state: "nuevo" },
] as const

const TICKET = [
  { qty: 1, name: "Lomo a lo pobre", note: "bien cocido" },
  { qty: 2, name: "Papas fritas", note: "" },
  { qty: 1, name: "Ensalada chilena", note: "sin cebolla" },
]

export function ComandasPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[34rem]", className)} aria-hidden>
      {/* Comanda del garzón */}
      <div className="relative z-10 w-[92%] -rotate-1 rounded-2xl border bg-card p-4 shadow-xl sm:w-[86%] sm:p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-xl font-semibold">Mesa 4</p>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">En cocina</span>
        </div>
        <ul className="mt-3 divide-y rounded-xl border text-sm">
          {ORDER.map((i) => (
            <li key={i.name} className="flex items-center gap-2.5 px-3 py-2">
              <span className="tabular w-5 text-center font-semibold">{i.qty}</span>
              <span className="min-w-0 flex-1 leading-tight">
                {i.name}
                {i.note ? <span className="block text-xs text-amber-700">{i.note}</span> : null}
                {i.state === "nuevo" ? <span className="block text-[11px] text-muted-foreground">Sin enviar a cocina</span> : null}
              </span>
              {i.state === "cocina" ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <ChefHat className="size-3" />
                </span>
              ) : null}
              <span className="tabular font-medium">{i.price}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-2">
          <p className="tabular mr-auto text-base font-semibold sm:text-lg">$15.890</p>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-medium whitespace-nowrap text-primary-foreground sm:px-3">
            <ChefHat className="size-3.5" />
            Enviar a cocina (2)
          </span>
          <span className="inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-medium sm:px-3">Cobrar</span>
        </div>
      </div>

      {/* Ticket en la pantalla de la cocina */}
      <div className="relative z-20 -mt-3 ml-auto w-[78%] rotate-1 overflow-hidden rounded-2xl border-2 border-amber-400 bg-card shadow-2xl sm:-mt-5 sm:w-[60%]">
        <div className="flex items-baseline justify-between bg-amber-50 px-3.5 py-2">
          <p className="font-display text-lg font-semibold">Mesa 7</p>
          <span className="tabular text-xs font-medium text-amber-700">16 min</span>
        </div>
        <ul className="divide-y text-sm">
          {TICKET.map((i) => (
            <li key={i.name} className="flex items-start gap-2 px-3.5 py-2">
              <span className="tabular font-bold">{i.qty}×</span>
              <span className="min-w-0 flex-1 leading-tight font-medium">
                {i.name}
                {i.note ? <span className="block text-xs font-semibold text-amber-700">{i.note}</span> : null}
              </span>
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border text-muted-foreground">
                <Check className="size-3" />
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t p-2.5">
          <span className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            <Check className="size-3.5" />
            Todo listo
          </span>
        </div>
      </div>
    </div>
  )
}
