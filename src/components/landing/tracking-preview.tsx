import { Check, PackageCheck } from "lucide-react"
import { cn } from "@/lib/utils"

// Dibujo del seguimiento del pedido: lo que ve el cliente en su enlace y el aviso por WhatsApp (datos de ejemplo).

const STEPS = [
  { label: "Recibido", time: "12:04", done: true },
  { label: "En preparación", time: "12:10", done: true },
  { label: "En camino", time: "12:35", done: true, current: true },
  { label: "Entregado", time: "", done: false },
]

export function TrackingPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[34rem]", className)} aria-hidden>
      {/* La página del cliente */}
      <div className="relative z-10 mx-auto w-[78%] rounded-[2rem] border-4 border-foreground/80 bg-card p-4 shadow-xl sm:w-[64%]">
        <p className="text-xs text-muted-foreground">Pedido n.º 7NCKY · Sushi Kento</p>
        <p className="mt-1 flex items-center gap-2 font-display text-xl font-semibold">
          <PackageCheck className="size-6 text-primary" />
          En camino
        </p>
        <ol className="mt-4">
          {STEPS.map((s, i) => (
            <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
              {i < STEPS.length - 1 ? <span className={cn("absolute top-6 left-[11px] h-[calc(100%-1.5rem)] w-0.5", s.done && STEPS[i + 1].done ? "bg-primary" : "bg-border")} /> : null}
              <span
                className={cn(
                  "relative flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  s.done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                  s.current && "ring-4 ring-primary/20",
                )}
              >
                {s.done ? <Check className="size-3.5" /> : null}
              </span>
              <span className="text-sm">
                <span className={cn("font-medium", !s.done && "text-muted-foreground")}>{s.label}</span>
                {s.time ? <span className="block text-xs text-muted-foreground">{s.time}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* El aviso por WhatsApp */}
      <div className="relative z-20 -mt-10 ml-auto w-[70%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] p-3 text-sm text-[#111] shadow-2xl sm:w-[54%]">
        <p>
          🛵 Tu pedido <strong>n.º 7NCKY</strong> va en camino.
        </p>
        <p className="mt-1 text-xs text-[#1f7a4d]">📦 Síguelo aquí: ordensimple.cl/pedido/…</p>
      </div>
    </div>
  )
}
