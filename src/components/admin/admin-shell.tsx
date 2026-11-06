"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Crown, LayoutDashboard, Mail, ShieldCheck, TrendingUp, Users, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const ICONS = { resumen: LayoutDashboard, usuarios: Users, crecimiento: TrendingUp, planes: Crown, correos: Mail, equipo: ShieldCheck } satisfies Record<string, LucideIcon>

export type AdminSection = {
  id: keyof typeof ICONS
  label: string
  title: string
  description: string
  count?: number
  tone?: "danger" | "warning"
  content: React.ReactNode
}

/**
 * El panel como un archivador: una pestaña por sección y se ve una a la vez. La pestaña activa se une a la hoja que abre.
 * La sección va en la dirección (#usuarios, #errores…), así los enlaces de siempre (el correo de errores, "Escribirle")
 * abren la sección correcta y bajan hasta su parte.
 */
export function AdminShell({ sections }: { sections: AdminSection[] }) {
  const [active, setActive] = useState<AdminSection["id"]>(sections[0].id)
  const sheet = useRef<HTMLDivElement>(null)
  const search = useSearchParams()

  const fromHash = useCallback(() => {
    const hash = decodeURIComponent(location.hash.slice(1))
    if (!hash) return
    const own = sections.find((s) => s.id === hash)
    if (own) return setActive(own.id)
    // Un enlace a una parte de adentro (#errores, #cobros, #correo-directo): abre su sección y baja hasta ella.
    const target = document.getElementById(hash)
    const part = target?.closest<HTMLElement>("[data-admin-section]")?.dataset.adminSection as AdminSection["id"] | undefined
    if (!part) return
    setActive(part)
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" })))
  }, [sections])

  // Al abrir, al cambiar el # y cuando un enlace cambia los filtros de la dirección.
  useEffect(() => {
    const raf = requestAnimationFrame(fromHash)
    window.addEventListener("hashchange", fromHash)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("hashchange", fromHash)
    }
  }, [fromHash, search])

  // En el celular las pestañas van en una franja deslizable: la activa siempre queda a la vista.
  useEffect(() => {
    const tab = document.getElementById(`pestana-${active}`)
    const list = tab?.parentElement
    if (!tab || !list || list.scrollWidth <= list.clientWidth) return
    const left = tab.offsetLeft - list.offsetLeft
    if (left < list.scrollLeft || left + tab.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollTo({ left: Math.max(0, left - 16) })
  }, [active])

  const open = (id: AdminSection["id"]) => {
    setActive(id)
    history.replaceState(null, "", `${location.pathname}${location.search}#${id}`)
    const top = sheet.current?.getBoundingClientRect().top ?? 0
    if (top < 0) sheet.current?.scrollIntoView({ block: "start" })
  }

  // Flechas para moverse entre pestañas, como en cualquier lista de pestañas.
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === "ArrowDown" || e.key === "ArrowRight" ? i + 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? i - 1 : null
    if (next === null) return
    e.preventDefault()
    const s = sections[(next + sections.length) % sections.length]
    open(s.id)
    document.getElementById(`pestana-${s.id}`)?.focus()
  }

  return (
    <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
      <div
        role="tablist"
        aria-label="Secciones del panel"
        aria-orientation="vertical"
        className="relative z-10 -mx-4 -mb-px flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:sticky lg:top-[calc(env(safe-area-inset-top)+5rem)] lg:mx-0 lg:mb-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0 lg:pt-6"
      >
        {sections.map((s, i) => {
          const Icon = ICONS[s.id]
          const on = s.id === active
          return (
            <button
              key={s.id}
              id={`pestana-${s.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`hoja-${s.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => open(s.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "relative flex min-h-11 shrink-0 items-center gap-2.5 border px-3.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                // Celular: pestañas arriba de la hoja. Computador: al costado izquierdo.
                "rounded-t-xl border-b-0 lg:rounded-t-none lg:rounded-l-xl lg:border-r-0 lg:border-b",
                on
                  ? "z-10 border-border bg-background font-medium text-foreground lg:-mr-px"
                  : "border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4 shrink-0", on ? "text-primary" : "opacity-70")} aria-hidden />
              <span className="lg:flex-1 lg:text-left">{s.label}</span>
              {s.count ? (
                <span
                  className={cn(
                    "tabular rounded-full px-1.5 text-xs leading-5",
                    s.tone === "danger" ? "bg-danger/15 text-danger" : s.tone === "warning" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
                  )}
                >
                  {s.count.toLocaleString("es-CL")}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div
        ref={sheet}
        className="relative -mx-4 min-h-[60vh] scroll-mt-20 border-y bg-background px-4 py-6 sm:mx-0 sm:rounded-2xl sm:rounded-tl-none sm:border sm:px-6 sm:py-8 lg:rounded-tl-2xl lg:px-10 lg:py-10"
      >
        {sections.map((s) => {
          const Icon = ICONS[s.id]
          return (
            <section
              key={s.id}
              id={`hoja-${s.id}`}
              role="tabpanel"
              aria-labelledby={`pestana-${s.id}`}
              data-admin-section={s.id}
              hidden={s.id !== active}
              className="space-y-8"
            >
              <header className="flex items-start gap-4">
                <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
                  <Icon className="size-6" aria-hidden />
                </span>
                <div className="min-w-0 space-y-1">
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{s.title}</h2>
                  <p className="max-w-2xl text-sm text-pretty text-muted-foreground sm:text-base">{s.description}</p>
                </div>
              </header>
              {s.content}
            </section>
          )
        })}
      </div>
    </div>
  )
}
