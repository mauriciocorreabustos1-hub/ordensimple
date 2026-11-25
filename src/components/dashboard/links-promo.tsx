"use client"

import * as React from "react"
import Link from "next/link"
import { Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const HIDE_KEY = "novedad-links-oculta"

/**
 * Novedad en el Inicio: crear la página de enlaces (OrdenSimple Links). Solo aparece si el negocio todavía no tiene
 * página; "Ahora no" la esconde para siempre en este equipo.
 */
export function LinksPromo({ businessId }: { businessId: string }) {
  const [hidden, setHidden] = React.useState(true)
  React.useEffect(() => {
    try {
      // Se lee después de montar: así no aparece y desaparece de golpe a quien ya la cerró.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(localStorage.getItem(HIDE_KEY) === businessId)
    } catch {
      setHidden(false)
    }
  }, [businessId])
  if (hidden) return null

  return (
    <section aria-labelledby="novedad-links" className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border bg-card p-4 shadow-xs md:p-5">
      {/* Un celular chico con tres botones: lo que se arma en Links. */}
      <span aria-hidden className="grid h-16 w-11 shrink-0 place-content-center gap-1 rounded-xl border-2 border-foreground/80 bg-primary/[0.07] px-1.5">
        <span className="mx-auto size-3 rounded-full bg-primary" />
        <span className="h-1.5 w-7 rounded-full bg-primary/70" />
        <span className="h-1.5 w-7 rounded-full bg-primary/70" />
        <span className="h-1.5 w-7 rounded-full bg-primary/40" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">Nuevo</span>
          <h2 id="novedad-links" className="font-display text-base font-semibold tracking-tight">
            Tu página de enlaces, lista en 2 minutos
          </h2>
        </div>
        <p className="text-sm text-pretty text-muted-foreground">
          Tu WhatsApp, tus redes, tu tienda y tus productos en un solo enlace para la biografía de Instagram y TikTok, con su QR para el mostrador.
        </p>
      </div>
      <div className="flex items-center gap-1.5 max-sm:w-full">
        <Button asChild className="max-sm:flex-1">
          <Link href="/dashboard/links">
            <Link2 /> Crear mi página
          </Link>
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setHidden(true)
            try {
              localStorage.setItem(HIDE_KEY, businessId)
            } catch {}
          }}
        >
          Ahora no
        </Button>
      </div>
    </section>
  )
}
