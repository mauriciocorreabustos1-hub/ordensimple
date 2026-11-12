"use client"

import Image from "next/image"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// Pantallas reales de la app (cuenta de demostración, datos de ejemplo), guardadas en /public/producto.
const SCREENS = [
  {
    id: "venta",
    label: "Registrar venta",
    src: "/producto/venta.jpg",
    width: 1024,
    height: 1370,
    alt: "Registrar venta en OrdenSimple: dos productos, pago en efectivo y el vuelto calculado",
    caption: "Eliges los productos o los escaneas, marcas cómo te pagaron y, si es en efectivo, te calcula el vuelto.",
  },
  {
    id: "caja",
    label: "Cierre de caja",
    src: "/producto/caja.jpg",
    width: 1840,
    height: 1400,
    alt: "Cierre de caja en OrdenSimple: ventas del día por medio de pago y cuadre del efectivo",
    caption: "Al final del día ves cuánto vendiste por cada medio de pago y cuadras el efectivo.",
  },
  {
    id: "reportes",
    label: "Reportes",
    src: "/producto/reportes.jpg",
    width: 1840,
    height: 1400,
    alt: "Reportes en OrdenSimple: vendiste, gastaste y cuánto te quedó, comparado con el período anterior",
    caption: "Cuánto vendiste, cuánto gastaste y cuánto te quedó, comparado con el período anterior.",
  },
] as const

const SPECS = [
  { label: "Funciona en", value: "Celular, computador y tablet" },
  { label: "Sin internet", value: "Las ventas se guardan en el equipo y se suben solas al volver la señal" },
  { label: "Descargas", value: "Tus ventas, gastos y reportes en Excel y PDF" },
  { label: "Tus datos", value: "En la nube, con respaldo, y solo los ves tú y tu equipo" },
  { label: "Para empezar", value: "Gratis y sin tarjeta" },
]

/** "Así se ve por dentro": tres pantallas reales con pestañas y, al lado, la ficha con lo que más se pregunta. */
export function ProductShowcase() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-12">
      <Tabs defaultValue="venta" className="gap-4">
        <TabsList className="grid w-full grid-cols-3 sm:w-fit">
          {SCREENS.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="px-3">
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {SCREENS.map((s) => (
          <TabsContent key={s.id} value={s.id} className="space-y-3">
            <figure className="overflow-hidden rounded-2xl border bg-card shadow-xl">
              <div aria-hidden className="flex items-center gap-1.5 border-b bg-muted/60 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-foreground/15" />
                <span className="size-2.5 rounded-full bg-foreground/15" />
                <span className="size-2.5 rounded-full bg-foreground/15" />
                <span className="ml-3 text-xs text-muted-foreground">ordensimple.cl</span>
              </div>
              <div className={cn("relative aspect-[1840/1400] overflow-hidden", s.id === "venta" && "bg-muted/50")}>
                <Image
                  src={s.src}
                  alt={s.alt}
                  width={s.width}
                  height={s.height}
                  sizes="(min-width: 1024px) 680px, 100vw"
                  className={cn(
                    s.id === "venta"
                      ? // La ventana de venta, desde "¿Cómo te pagaron?" hasta el vuelto, como abierta sobre la app.
                        "absolute bottom-0 left-1/2 w-[56%] max-w-[24rem] -translate-x-1/2 rounded-t-xl border border-b-0 shadow-lg"
                      : "h-full w-full object-cover object-top",
                  )}
                />
              </div>
            </figure>
            <figcaption className="text-sm text-pretty text-muted-foreground">{s.caption}</figcaption>
          </TabsContent>
        ))}
      </Tabs>

      <div className="space-y-4">
        <h3 className="font-display text-xl font-semibold tracking-tight">Ficha</h3>
        <dl className="border-t border-foreground/80">
          {SPECS.map((s) => (
            <div key={s.label} className="grid gap-1 border-b py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-semibold">{s.label}</dt>
              <dd className="text-sm text-pretty text-muted-foreground">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
