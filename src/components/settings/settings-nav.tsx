"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { SETTINGS_SECTIONS, settingsHref, type SettingsSection } from "@/lib/settings-sections"
import { cn } from "@/lib/utils"

/** Enlaces antiguos con #mesas, #avisos… llevan a la categoría donde quedó esa parte. */
const HASH_SECTION: Record<string, SettingsSection> = {
  mesas: "negocio",
  tienda: "tienda",
  avisos: "avisos",
  equipo: "equipo",
  seguridad: "cuenta",
  "dos-pasos": "cuenta",
  cuenta: "cuenta",
}

/** Menú de categorías de Configuración: a la izquierda en el computador, en fila deslizable en el celular. */
export function SettingsNav({ active }: { active: SettingsSection }) {
  const router = useRouter()

  React.useEffect(() => {
    const target = HASH_SECTION[window.location.hash.slice(1)]
    if (target && target !== active) router.replace(`${settingsHref(target)}${window.location.hash}`)
  }, [active, router])

  // En el celular, la categoría elegida queda a la vista en la fila.
  const activeRef = React.useRef<HTMLAnchorElement>(null)
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [active])

  return (
    <nav aria-label="Categorías de configuración" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0">
        {SETTINGS_SECTIONS.map((s) => {
          const on = s.id === active
          const Icon = s.icon
          return (
            <li key={s.id} className="shrink-0">
              <Link
                ref={on ? activeRef : undefined}
                href={settingsHref(s.id)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors lg:border-transparent lg:py-2.5",
                  on ? "border-primary/30 bg-primary/10 text-primary lg:border-primary/20" : "bg-card hover:bg-muted lg:bg-transparent",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg",
                    on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium whitespace-nowrap">{s.label}</span>
                  <span className={cn("hidden text-xs lg:block", on ? "text-primary/80" : "text-muted-foreground")}>{s.hint}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
