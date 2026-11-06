"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export type AdminNavItem = { id: string; label: string; count?: number; tone?: "danger" | "warning" }

/**
 * Índice del panel, como las pestañas de un archivador: al costado en el computador y como franja deslizable arriba en el
 * celular. Marca la parte que se está viendo.
 */
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id)

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => Boolean(e))
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      // Cuenta como "actual" la parte que cruza la franja de arriba de la pantalla.
      { rootMargin: "-120px 0px -65% 0px" },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [items])

  // En el celular, la pestaña activa queda a la vista dentro de la franja.
  useEffect(() => {
    const tab = document.querySelector<HTMLElement>(`[data-admin-tab="${active}"]`)
    const list = tab?.closest("ol")
    if (!tab || !list || list.scrollWidth <= list.clientWidth) return
    const left = tab.offsetLeft - list.offsetLeft
    if (left < list.scrollLeft || left + tab.offsetWidth > list.scrollLeft + list.clientWidth)
      list.scrollTo({ left: left - 16, behavior: "smooth" })
  }, [active])

  return (
    <nav
      aria-label="Partes del panel"
      className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 -mx-4 border-b bg-background/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:top-[calc(env(safe-area-inset-top)+5.5rem)] lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
    >
      <p className="mb-2 hidden px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:block">En este panel</p>
      <ol className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:border-l lg:py-0">
        {items.map((item, i) => {
          const on = active === item.id
          return (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                data-admin-tab={item.id}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "flex min-h-9 items-center gap-2 rounded-full px-3 text-sm whitespace-nowrap transition-colors lg:-ml-px lg:min-h-10 lg:rounded-none lg:border-l-2 lg:border-transparent",
                  on
                    ? "bg-primary text-primary-foreground lg:border-primary lg:bg-transparent lg:font-medium lg:text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground lg:hover:bg-transparent",
                )}
              >
                <span className={cn("tabular hidden w-5 text-xs lg:inline", on ? "text-primary" : "text-muted-foreground/70")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="lg:flex-1">{item.label}</span>
                {item.count ? (
                  <span
                    className={cn(
                      "tabular rounded-full px-1.5 text-xs leading-5",
                      on && "max-lg:bg-primary-foreground/20 max-lg:text-primary-foreground",
                      !on && item.tone === "danger" && "bg-danger/15 text-danger",
                      !on && item.tone === "warning" && "bg-warning/15 text-warning",
                      !on && !item.tone && "bg-muted text-muted-foreground",
                      on && "lg:bg-muted lg:text-muted-foreground",
                      on && item.tone === "danger" && "lg:bg-danger/15 lg:text-danger",
                    )}
                  >
                    {item.count.toLocaleString("es-CL")}
                  </span>
                ) : null}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
