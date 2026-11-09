import { Check, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

// Dibujo de las cotizaciones: lo que ve el cliente en su enlace y el aviso cuando la acepta (datos de ejemplo).

export function QuotePreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[34rem]", className)} aria-hidden>
      {/* La cotización, como la abre el cliente */}
      <div className="relative z-10 w-[92%] rounded-2xl border bg-card p-4 shadow-xl sm:w-[84%] sm:p-5">
        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div>
            <p className="font-display text-base font-semibold">Ferretería El Roble</p>
            <p className="text-xs text-muted-foreground">RUT 76.123.456-7</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Cotización</p>
            <p className="tabular font-semibold">N.º 0042</p>
          </div>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex justify-between gap-3">
            <span>20 × Cemento 25 kg</span>
            <span className="tabular">$119.800</span>
          </li>
          <li className="flex justify-between gap-3">
            <span>10 × Fierro 8 mm</span>
            <span className="tabular">$45.900</span>
          </li>
          <li className="flex justify-between gap-3">
            <span>Despacho a obra</span>
            <span className="tabular">$15.000</span>
          </li>
        </ul>
        <div className="mt-3 space-y-0.5 border-t pt-3 text-sm">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Neto $151.849 · IVA $28.851</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="tabular text-xl font-semibold">$180.700</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground">
          <Check className="size-4" />
          Aceptar cotización
        </div>
      </div>

      {/* Lo que ve el negocio */}
      <div className="relative z-20 -mt-4 ml-auto w-[72%] rounded-2xl border bg-card p-3 shadow-2xl sm:w-[58%]">
        <p className="text-xs font-semibold text-success">✅ Cotización n.º 0042 aceptada</p>
        <p className="mt-1 text-sm font-medium">Constructora Los Andes</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Eye className="size-3.5" />
          La abrió hoy a las 10:42
        </p>
      </div>
    </div>
  )
}
