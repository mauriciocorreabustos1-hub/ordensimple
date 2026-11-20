"use client"

import * as React from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"
import { Check, X } from "lucide-react"

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * "Lo que cambia cuando dejas el cuaderno": al bajar, cada problema del cuaderno se tacha a lápiz, línea por línea,
 * y su par con OrdenSimple se marca con el visto bueno. Va ligado al scroll (avanza y retrocede con él).
 * Sin JavaScript o con "reducir movimiento", se ve directamente tachado y marcado.
 */
export function NotebookStrike({ rows }: { rows: { before: string; after: string }[] }) {
  const root = React.useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-row]", root.current).forEach((row) => {
          const strike = row.querySelector<HTMLElement>("[data-strike]")
          const check = row.querySelector<HTMLElement>("[data-check]")
          const after = row.querySelector<HTMLElement>("[data-after]")
          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: { trigger: row, start: "top 80%", end: "top 45%", scrub: 0.5 },
          })
          // El lápiz recorre el texto de principio a fin, también cuando ocupa dos líneas.
          tl.fromTo(strike, { "--strike": "0%" }, { "--strike": "100%", duration: 1 })
            .fromTo(row.querySelector("[data-before]"), { opacity: 1 }, { opacity: 0.55, duration: 0.6 }, 0.4)
            .fromTo(check, { scale: 0, rotate: -25 }, { scale: 1, rotate: 0, duration: 0.35, ease: "back.out(2.5)" }, 0.75)
            .fromTo(after, { opacity: 0.35 }, { opacity: 1, duration: 0.4 }, 0.7)
        })
      })
    },
    { scope: root },
  )

  return (
    <div ref={root} className="overflow-hidden rounded-2xl border bg-card">
      <div className="hidden grid-cols-2 border-b text-sm font-medium sm:grid">
        <p className="bg-muted/40 py-3.5 pr-5 pl-12 leading-7 text-muted-foreground">Con el cuaderno</p>
        <p className="border-l px-5 py-3.5 leading-7">Con OrdenSimple</p>
      </div>
      <ul>
        {rows.map((row) => (
          <li key={row.after} data-row className="grid sm:grid-cols-2">
            <p data-before className="relative bg-muted/40 py-3.5 pr-5 pl-12 leading-7 text-pretty text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
              <X className="absolute top-[1.3rem] left-4 size-4 text-muted-foreground/70" aria-hidden />
              <span className="sr-only">Antes: </span>
              <span data-strike className="notebook-strike">
                {row.before}
              </span>
            </p>
            <p className="flex gap-2.5 px-5 py-3.5 leading-7 font-medium text-pretty shadow-[inset_0_-1px_0_var(--border)] sm:border-l">
              <Check data-check className="mt-1.5 size-4 shrink-0 text-primary" />
              <span data-after>{row.after}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
