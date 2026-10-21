import { ScanLine } from "lucide-react"
import { BarcodeSvg } from "@/components/products/barcode-svg"
import { cn } from "@/lib/utils"

// Dibujo de una hoja de etiquetas con código de barras y la venta escaneando (datos de ejemplo).

const LABELS = [
  { name: "Pan amasado (kg)", price: "$2.400", code: "2001167016987" },
  { name: "Queso de campo", price: "$6.990", code: "2032551332826" },
  { name: "Mermelada casera", price: "$3.500", code: "2080066436096" },
  { name: "Empanada de pino", price: "$2.200", code: "2045120893312" },
]

export function LabelsPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[34rem]", className)} aria-hidden>
      {/* Hoja de stickers */}
      <div className="relative z-10 w-[92%] -rotate-1 rounded-2xl border bg-white p-3 shadow-xl sm:w-[84%] sm:p-4">
        <div className="grid grid-cols-2 gap-2">
          {LABELS.map((l) => (
            <div key={l.code} className="rounded-md border border-dashed border-neutral-300 p-2 text-black">
              <p className="truncate text-[11px] font-semibold">{l.name}</p>
              <p className="text-sm font-bold">{l.price}</p>
              <BarcodeSvg value={l.code} height="26px" className="mt-1" />
              <p className="text-center text-[9px] tracking-wider tabular-nums">{l.code}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Al vender: se escanea y se agrega */}
      <div className="relative z-20 -mt-8 ml-auto w-[70%] rotate-1 rounded-2xl border-2 border-primary/40 bg-card p-3.5 shadow-2xl sm:-mt-12 sm:w-[54%]">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <ScanLine className="size-3.5" />
          Escaneado
        </p>
        <p className="mt-1 text-sm font-semibold">Pan amasado (kg)</p>
        <p className="text-xs text-muted-foreground">Agregado a la venta · $2.400</p>
      </div>
    </div>
  )
}
