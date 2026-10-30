import { Monitor, Printer } from "lucide-react"
import { cn } from "@/lib/utils"

// Dibujo de OrdenSimple para PC: la ventana de la caja y la comanda que sale sola en la impresora (datos de ejemplo).

const ITEMS = [
  { qty: 2, name: "Lomo a lo pobre", note: "Uno sin cebolla" },
  { qty: 1, name: "Ensalada chilena" },
  { qty: 3, name: "Bebida 500 cc" },
]

export function DesktopPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[34rem]", className)} aria-hidden>
      {/* Ventana de la app en el PC */}
      <div className="relative z-10 w-[92%] overflow-hidden rounded-2xl border bg-card shadow-xl sm:w-[86%]">
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
        <div className="space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold">Mesa 4</p>
            <p className="tabular text-sm text-muted-foreground">$27.870</p>
          </div>
          <div className="space-y-1.5 text-sm">
            {ITEMS.map((i) => (
              <div key={i.name} className="flex justify-between gap-2">
                <span>
                  {i.qty} × {i.name}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Enviar a cocina</span>
            <span className="rounded-lg border px-3 py-1.5 text-xs font-medium">Imprimir cuenta</span>
          </div>
        </div>
      </div>

      {/* La comanda que sale sola */}
      <div className="relative z-20 -mt-1 ml-auto w-[66%] rotate-2 sm:-mt-14 sm:w-[48%]">
        <p className="mb-1.5 flex items-center justify-end gap-1.5 text-xs font-semibold text-primary">
          <Printer className="size-3.5" />
          Salió sola, sin Ctrl + P
        </p>
        <div className="rounded-b-md border border-neutral-200 bg-white p-3 font-mono text-[11px] leading-snug text-black shadow-2xl">
          <p className="text-center text-sm font-bold">MESA 4</p>
          <p className="text-center text-[10px]">Comanda 13:42</p>
          <p className="my-1 overflow-hidden whitespace-nowrap">================================</p>
          {ITEMS.map((i) => (
            <div key={i.name}>
              <p className="font-bold">
                {i.qty} x {i.name}
              </p>
              {i.note ? <p className="pl-2">Nota: {i.note}</p> : null}
            </div>
          ))}
          <p className="mt-1 overflow-hidden whitespace-nowrap">================================</p>
        </div>
      </div>
    </div>
  )
}
