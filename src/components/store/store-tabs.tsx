"use client"

import * as React from "react"
import { CalendarCheck, ShoppingBasket } from "lucide-react"
import { cn } from "@/lib/utils"

/** Página de un negocio que reserva horas y también vende productos: dos pestañas, cada cosa por su lado. */
export function StoreTabs({ booking, products }: { booking: React.ReactNode; products: React.ReactNode }) {
  const [tab, setTab] = React.useState<"reservar" | "productos">("reservar")
  const tabs = [
    { id: "reservar" as const, label: "Reservar hora", icon: CalendarCheck },
    { id: "productos" as const, label: "Productos", icon: ShoppingBasket },
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Qué quieres hacer">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>
      {/* Las dos se mantienen montadas: el carro y la reserva no se pierden al cambiar de pestaña. */}
      <div role="tabpanel" hidden={tab !== "reservar"}>
        {booking}
      </div>
      <div role="tabpanel" hidden={tab !== "productos"}>
        {products}
      </div>
    </div>
  )
}
