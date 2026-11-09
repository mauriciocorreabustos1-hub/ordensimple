import { Check, Gift } from "lucide-react"
import { cn } from "@/lib/utils"

// Dibujo de la tarjeta de fidelidad: la tarjeta en el celular del cliente y el aviso al vender (datos de ejemplo).

const GOAL = 10
const STAMPS = 7

export function LoyaltyPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[34rem]", className)} aria-hidden>
      {/* La tarjeta del cliente */}
      <div className="relative z-10 w-[92%] overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-emerald-800 p-5 text-primary-foreground shadow-xl sm:w-[84%]">
        <div className="absolute -top-14 -right-14 size-40 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white text-lg">☕</span>
          <div>
            <p className="font-display text-lg font-semibold">Café La Esquina</p>
            <p className="text-sm text-white/80">Tarjeta de Camila</p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-5 gap-2">
          {Array.from({ length: GOAL }, (_, i) => (
            <span
              key={i}
              className={cn(
                "flex aspect-square items-center justify-center rounded-full border-2",
                i < STAMPS ? "border-white bg-white text-primary" : "border-dashed border-white/40",
              )}
            >
              {i < STAMPS ? <Check className="size-4" strokeWidth={3} /> : null}
            </span>
          ))}
        </div>
        <p className="relative mt-4 flex items-center gap-2 text-sm font-medium">
          <Gift className="size-4" />
          Te faltan 3 sellos para un café gratis
        </p>
      </div>

      {/* El aviso al vender */}
      <div className="relative z-20 -mt-4 ml-auto w-[76%] rounded-2xl border bg-card p-3 shadow-2xl sm:w-[60%]">
        <p className="text-sm font-medium">✅ Venta de $3.500 guardada</p>
        <p className="text-xs text-primary">+1 sello para Camila (7 de 10)</p>
      </div>
    </div>
  )
}
