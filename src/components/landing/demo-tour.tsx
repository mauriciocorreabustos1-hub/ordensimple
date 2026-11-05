"use client"

import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

// Recorrido por la app real con datos de ejemplo de "Almacén Don Pedro" (capturas en /public/demo). No pide cuenta.
const STEPS = [
  { id: "inicio", label: "Inicio", title: "Así empiezas el día", text: "Apenas entras ves cuánto vendiste hoy, cuánto gastaste y cuánto te quedó, y si tu negocio va bien o hay algo que revisar." },
  { id: "ventas", label: "Ventas", title: "Cada venta queda anotada", text: "Con la hora, lo que se llevó y cómo pagó. Desde cada venta abres su comprobante para imprimirlo o mandarlo por WhatsApp." },
  { id: "inventario", label: "Inventario", title: "Tu stock al día", text: "Cuánto vale lo que tienes en bodega, qué se está acabando y qué ya se agotó, para reponer antes de que te lo pidan." },
  { id: "clientes", label: "Clientes y fiado", title: "Quién te debe y cuánto", text: "El fiado queda a nombre de cada cliente. Ves quién te compra más y le recuerdas su deuda por WhatsApp con un toque." },
  { id: "caja", label: "Cierre de caja", title: "Cierras la caja en un minuto", text: "Cuánto entró por cada medio de pago y cuánto efectivo debería haber. Cuentas, comparas y sabes si cuadra." },
  { id: "reportes", label: "Reportes", title: "Compara cómo te va", text: "Ventas y gastos por día del período que elijas, comparados con el anterior. Los puedes descargar en Excel." },
] as const

export function DemoTour() {
  const [index, setIndex] = React.useState(0)
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([])
  const step = STEPS[index]

  function onKey(e: React.KeyboardEvent) {
    const last = STEPS.length - 1
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null
    if (next === null) return
    e.preventDefault()
    setIndex(next)
    tabs.current[next]?.focus()
    tabs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
      <div role="tablist" aria-label="Pantallas de la app" aria-orientation="vertical" onKeyDown={onKey} className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        {STEPS.map((s, i) => {
          const active = i === index
          return (
            <button
              key={s.id}
              ref={(el) => {
                tabs.current[i] = el
              }}
              id={`demo-${s.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="demo-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => setIndex(i)}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-3 rounded-xl border px-4 text-left text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:py-3 lg:text-[15px]",
                active ? "border-primary bg-primary/10 text-foreground" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("tabular hidden size-6 shrink-0 items-center justify-center rounded-full text-xs lg:flex", active ? "bg-primary text-primary-foreground" : "bg-muted")}>{i + 1}</span>
              {s.label}
            </button>
          )
        })}
      </div>

      <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-${step.id}`} className="min-w-0">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{step.title}</h2>
        <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">{step.text}</p>
        <div className="mt-5 overflow-hidden rounded-2xl border bg-card shadow-xl">
          <Image
            key={`pc-${step.id}`}
            src={`/demo/${step.id}-pc.png`}
            alt={`Pantalla de ${step.label} en OrdenSimple, con datos de ejemplo`}
            width={1920}
            height={1200}
            sizes="(min-width: 1024px) 860px, 100vw"
            priority={index === 0}
            className="hidden h-auto w-full sm:block"
          />
          <Image
            key={`cel-${step.id}`}
            src={`/demo/${step.id}-cel.png`}
            alt={`Pantalla de ${step.label} en el celular, con datos de ejemplo`}
            width={780}
            height={1560}
            sizes="100vw"
            priority={index === 0}
            className="h-auto w-full sm:hidden"
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="min-h-11 rounded-lg px-3 font-medium text-primary disabled:text-muted-foreground disabled:opacity-60">
            Anterior
          </button>
          <span className="tabular text-muted-foreground">
            {index + 1} de {STEPS.length}
          </span>
          <button type="button" onClick={() => setIndex((i) => Math.min(STEPS.length - 1, i + 1))} disabled={index === STEPS.length - 1} className="min-h-11 rounded-lg px-3 font-medium text-primary disabled:text-muted-foreground disabled:opacity-60">
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
