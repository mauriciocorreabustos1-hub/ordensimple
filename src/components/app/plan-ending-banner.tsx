"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Crown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const HIDE_KEY = "aviso-plan-oculto-hasta"

/**
 * Aviso de que el plan está por vencer (o venció hace poco), arriba de cada pantalla. Solo lo ve quien puede
 * contratar (dueño o administrador). Se oculta por un día y no aparece en Tu plan, donde ya se ve todo.
 */
export function PlanEndingBanner({ planName, endsLabel, daysLeft, href }: { planName: string; endsLabel: string; daysLeft: number; href: string }) {
  const pathname = usePathname()
  const [hidden, setHidden] = React.useState(false)
  React.useEffect(() => {
    try {
      // Se lee después de montar para que el servidor y el navegador dibujen lo mismo la primera vez.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Number(localStorage.getItem(HIDE_KEY) ?? 0) > Date.now()) setHidden(true)
    } catch {}
  }, [])
  if (hidden || pathname.startsWith("/dashboard/plan") || pathname.startsWith("/dashboard/primeros-pasos")) return null

  const ended = daysLeft < 0
  const title = ended
    ? `Tu plan ${planName} venció ${endsLabel}`
    : daysLeft === 0
      ? `Tu plan ${planName} vence hoy`
      : `Tu plan ${planName} vence ${daysLeft === 1 ? "mañana" : `en ${daysLeft} días`}, ${endsLabel}`
  const detail = ended
    ? `Las funciones ${planName} quedaron en pausa. Tus ventas, productos y clientes siguen guardados.`
    : `Después, las funciones ${planName} quedan en pausa. Tus datos no se borran.`

  return (
    <div
      role="status"
      className={cn(
        "mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3 text-sm",
        ended || daysLeft <= 1 ? "border-warning/40 bg-warning/10" : "border-primary/25 bg-primary/[0.06]",
      )}
    >
      <Crown className={cn("size-5 shrink-0", ended || daysLeft <= 1 ? "text-warning" : "text-primary")} aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-muted-foreground">{detail}</span>
      </p>
      <div className="flex items-center gap-1.5 max-sm:w-full max-sm:pl-9">
        <Button size="sm" asChild>
          <Link href={href}>{ended ? `Volver a ${planName}` : `Seguir con ${planName}`}</Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ocultar este aviso por hoy"
          title="Ocultar por hoy"
          onClick={() => {
            setHidden(true)
            try {
              localStorage.setItem(HIDE_KEY, String(Date.now() + 86_400_000))
            } catch {}
          }}
        >
          <X />
        </Button>
      </div>
    </div>
  )
}
