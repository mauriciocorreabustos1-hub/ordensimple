import { CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"

// Dibujo de los cobros online: el enlace de pago en el celular del cliente y el aviso al negocio (datos de ejemplo).

export function PaymentsPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[34rem]", className)} aria-hidden>
      {/* Lo que ve el cliente */}
      <div className="relative z-10 mx-auto w-[78%] rotate-1 rounded-[2rem] border-4 border-foreground/80 bg-card p-5 text-center shadow-xl sm:w-[64%]">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-xl">🎂</span>
        <p className="mt-2 text-xs text-muted-foreground">Pago a</p>
        <p className="font-display text-lg font-semibold">Pastelería Dulce Hogar</p>
        <div className="mt-3 rounded-2xl bg-muted/60 p-3">
          <p className="text-sm">Torta de cumpleaños (abono)</p>
          <p className="tabular text-2xl font-semibold">$15.000</p>
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground">
          <CreditCard className="size-4" />
          Pagar $15.000
        </div>
      </div>

      {/* El aviso al negocio */}
      <div className="relative z-20 -mt-8 ml-auto w-[76%] -rotate-2 rounded-2xl border bg-card p-3 shadow-2xl sm:w-[60%]">
        <p className="text-sm font-medium">💳 Pagaron Torta de cumpleaños: $15.000</p>
        <p className="text-xs text-muted-foreground">Con Mercado Pago. Ya está en tu cuenta.</p>
      </div>
    </div>
  )
}
