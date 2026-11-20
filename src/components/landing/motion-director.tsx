"use client"

import { usePathname } from "next/navigation"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"
import { useGSAP } from "@gsap/react"

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP)

/**
 * Coreografía de la web pública (las páginas marcan qué se anima con atributos data-*):
 * - data-progress: barra de avance de la página.
 * - data-site-header: el menú se esconde al bajar y vuelve al subir.
 * - data-hero / data-hero-title / data-hero-item / data-hero-tag / data-hero-art: entrada de la portada y parallax.
 * - data-split: títulos que suben línea por línea, como si salieran de una ranura.
 * - data-up: bloques que suben al aparecer. data-stagger: sus hijos aparecen en cascada.
 * - data-words: frase que se va "escribiendo" con el scroll (cada palabra se enciende).
 * - data-tilt: imagen que se endereza en 3D al bajar.
 * - data-receipt: comprobante que se imprime y sus filas aparecen una a una.
 * - data-marquee: la cinta de rubros, que acelera y se inclina según la velocidad del scroll.
 * - data-footer-word: la palabra grande del pie, letra por letra; con el mouse, las letras se levantan.
 * - data-magnetic: botones que siguen un poco al mouse.
 * Con "reducir movimiento" no se anima nada y todo se ve en su lugar.
 */
export function MotionDirector() {
  const pathname = usePathname()

  useGSAP(
    () => {
      const html = document.documentElement
      const mm = gsap.matchMedia()
      const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel))

      mm.add("(prefers-reduced-motion: reduce)", () => {
        html.classList.remove("motion")
      })

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        /* Barra de avance y menú que se esconde al bajar */
        const bar = document.querySelector("[data-progress]")
        if (bar) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } })
        const header = document.querySelector<HTMLElement>("[data-site-header]")
        if (header) {
          ScrollTrigger.create({
            start: 0,
            end: "max",
            onUpdate: (self) => {
              const hide = self.direction === 1 && self.scroll() > 520 && !header.querySelector("[data-state=open]")
              header.toggleAttribute("data-hidden", hide)
            },
          })
        }

        /* Portada: la entrada la hace el CSS apenas se pinta (no espera a que cargue nada; ver globals.css).
           Aquí, en computador y al bajar: el comprobante sube más lento, la etiqueta gira y el texto se aleja. */
        const hero = document.querySelector<HTMLElement>("[data-hero]")
        if (hero) {
          gsap.matchMedia().add("(min-width: 1024px)", () => {
            gsap
              .timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } })
              .fromTo($$("[data-hero-art]", hero), { yPercent: 0, rotate: 0 }, { yPercent: -14, rotate: -2, ease: "none" }, 0)
              .fromTo($$("[data-hero-tag]", hero), { yPercent: 0, rotate: 0 }, { rotate: 18, yPercent: 40, ease: "none" }, 0)
              .fromTo($$("[data-hero-copy]", hero), { yPercent: 0, opacity: 1 }, { yPercent: -8, opacity: 0.35, ease: "none" }, 0)
          })
        }

        /* Títulos línea por línea */
        $$("[data-split]").forEach((el) => {
          if (el.closest("[data-hero]")) return
          SplitText.create(el, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.lines, { yPercent: 115, duration: 1.1, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: el, start: "top 88%", once: true } }),
          })
        })

        /* Bloques que suben y listas en cascada */
        $$("[data-up]").forEach((el) => {
          gsap.from(el, { y: 40, autoAlpha: 0, duration: 1.1, ease: "expo.out", clearProps: "transform,opacity,visibility", scrollTrigger: { trigger: el, start: "top 88%", once: true } })
        })
        $$("[data-stagger]").forEach((box) => {
          gsap.from(box.children, {
            y: 36,
            autoAlpha: 0,
            duration: 1,
            stagger: 0.09,
            ease: "expo.out",
            clearProps: "transform,opacity,visibility",
            scrollTrigger: { trigger: box, start: "top 85%", once: true },
          })
        })

        /* Frase que se enciende palabra por palabra con el scroll */
        $$("[data-words]").forEach((el) => {
          const words = SplitText.create(el, { type: "words", aria: "none" }).words
          gsap.from(words, { opacity: 0.18, stagger: 0.12, ease: "none", scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 50%", scrub: 0.6 } })
        })

        /* La frase grande: cada palabra pasa a tinta y un círculo a lápiz encierra la idea.
           En computador la sección queda fija mientras se escribe. */
        $$("[data-manifesto]").forEach((sec) => {
          const text = sec.querySelector<HTMLElement>("[data-manifesto-text]")
          if (!text) return
          const words = SplitText.create(text, { type: "words" }).words
          const circle = sec.querySelector("[data-manifesto-circle] path")
          gsap.matchMedia().add({ desk: "(min-width: 1024px)", mob: "(max-width: 1023px)" }, (c) => {
            const tl = gsap.timeline({
              scrollTrigger: c.conditions?.desk
                ? { trigger: sec, start: "top top", end: "+=130%", pin: true, scrub: 0.6, anticipatePin: 1 }
                : { trigger: text, start: "top 80%", end: "bottom 40%", scrub: 0.6 },
            })
            tl.from(words, { opacity: 0.12, y: 6, stagger: 0.1, ease: "none" })
            if (circle) tl.fromTo(circle, { strokeDashoffset: 1, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 1.2, ease: "power1.inOut" })
          })
        })

        /* Cronómetro de "Cómo funciona": la línea verde avanza con el scroll y cada minuto se enciende al llegar */
        $$("[data-stopwatch]").forEach((ol) => {
          const fill = ol.querySelector("[data-stopwatch-fill]")
          if (fill) gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: ol, start: "top 60%", end: "bottom 60%", scrub: 0.4 } })
          $$("li", ol).forEach((li) => {
            gsap.fromTo(
              li,
              { opacity: 0.3 },
              { opacity: 1, duration: 0.5, ease: "power2.out", scrollTrigger: { trigger: li, start: "top 62%", toggleActions: "play none none reverse" } },
            )
          })
        })

        /* Funciones: cada guion se dibuja a lápiz y su texto aparece detrás */
        $$("[data-ticks]").forEach((ul) => {
          const items = Array.from(ul.children)
          const tl = gsap.timeline({ scrollTrigger: { trigger: ul, start: "top 85%", once: true } })
          tl.from($$("[data-tick]", ul), { scaleX: 0, duration: 0.5, stagger: 0.07, ease: "power2.inOut" }).from(
            items,
            { autoAlpha: 0, x: -10, duration: 0.6, stagger: 0.07, ease: "power3.out", clearProps: "transform,opacity,visibility" },
            0.15,
          )
        })

        /* Tarjeta de cierre: entra como un ticket que te pasan por el mesón */
        $$("[data-cta-card]").forEach((card) => {
          gsap.fromTo(
            card,
            { y: 90, rotate: -4, scale: 0.94 },
            { y: 0, rotate: 0, scale: 1, ease: "none", scrollTrigger: { trigger: card, start: "top bottom", end: "top 45%", scrub: 0.6 } },
          )
        })

        /* Pantallas de la app que se acercan al bajar */
        $$("[data-zoom]").forEach((el) => {
          gsap.fromTo(el, { scale: 0.88, y: 60 }, { scale: 1, y: 0, ease: "none", scrollTrigger: { trigger: el, start: "top 98%", end: "top 40%", scrub: 0.6 } })
        })

        /* Número de atención que gira como la máquina de turnos */
        $$("[data-count]").forEach((el) => {
          const end = Number(el.dataset.count)
          if (!Number.isFinite(end) || end <= 0) return
          const fmt = (n: number) => (end < 1000 ? String(n).padStart(3, "0") : n.toLocaleString("es-CL"))
          const o = { v: 0 }
          gsap.to(o, {
            v: end,
            duration: 1.8,
            delay: 0.9,
            ease: "power3.out",
            onUpdate: () => {
              el.textContent = fmt(Math.round(o.v))
            },
            onComplete: () => {
              el.textContent = fmt(end)
            },
          })
        })

        /* Imagen que se endereza en 3D */
        $$("[data-tilt]").forEach((el) => {
          gsap.fromTo(
            el,
            { rotateX: 22, rotateY: -8, scale: 0.9, transformPerspective: 1200, transformOrigin: "50% 100%" },
            { rotateX: 0, rotateY: 0, scale: 1, ease: "none", scrollTrigger: { trigger: el, start: "top 95%", end: "top 35%", scrub: 0.6 } },
          )
        })

        /* Comprobante que se imprime */
        $$("[data-receipt]").forEach((el) => {
          const rows = $$("[data-receipt-row]", el)
          gsap
            .timeline({ scrollTrigger: { trigger: el, start: "top 80%", once: true } })
            .from(el, { yPercent: -12, clipPath: "inset(0 0 100% 0)", duration: 1.2, ease: "power3.inOut" })
            .from(rows, { autoAlpha: 0, x: -12, duration: 0.45, stagger: 0.12, ease: "power2.out" }, 0.5)
            .fromTo($$("[data-receipt-stamp]", el), { scale: 2.6, autoAlpha: 0, rotate: -30 }, { scale: 1, autoAlpha: 1, rotate: -8, duration: 0.5, ease: "back.out(1.6)" }, ">-0.05")
            .to(el, { x: 3, duration: 0.05, yoyo: true, repeat: 3, ease: "none" }, "<0.3")
        })

        /* Cinta de rubros: acelera y se inclina con la velocidad del scroll */
        const marqueeCleanups: (() => void)[] = []
        $$("[data-marquee]").forEach((track) => {
          track.style.animation = "none"
          const loop = gsap.to(track, { xPercent: -50, duration: 55, ease: "none", repeat: -1 })
          const skewTo = gsap.quickTo(track, "skewX", { duration: 0.6, ease: "power3" })
          ScrollTrigger.create({
            trigger: track,
            start: "top bottom",
            end: "bottom top",
            onUpdate: (self) => {
              const v = self.getVelocity()
              loop.timeScale(gsap.utils.clamp(1, 7, 1 + Math.abs(v) / 300))
              gsap.to(loop, { timeScale: 1, duration: 1.4, ease: "power2.out", overwrite: true })
              skewTo(gsap.utils.clamp(-8, 8, v / -250))
            },
            onToggle: (self) => {
              if (!self.isActive) skewTo(0)
            },
          })
          const settle = () => skewTo(0)
          ScrollTrigger.addEventListener("scrollEnd", settle)
          marqueeCleanups.push(() => {
            ScrollTrigger.removeEventListener("scrollEnd", settle)
            track.style.animation = ""
          })
        })

        /* Palabra grande del pie */
        const word = document.querySelector<HTMLElement>("[data-footer-word]")
        if (word) {
          gsap.from(word.children, {
            yPercent: 105,
            duration: 1.3,
            stagger: 0.05,
            ease: "expo.out",
            scrollTrigger: { trigger: word, start: "top 98%", toggleActions: "play none none reverse" },
          })
        }

        /* Con mouse: letras del pie que se levantan y botones magnéticos */
        gsap.matchMedia().add("(hover: hover) and (pointer: fine)", () => {
          const cleanups: (() => void)[] = []
          if (word) {
            const letters = Array.from(word.children) as HTMLElement[]
            const setters = letters.map((l) => gsap.quickTo(l, "y", { duration: 0.5, ease: "power3" }))
            const move = (e: PointerEvent) =>
              letters.forEach((l, i) => {
                const r = l.getBoundingClientRect()
                const d = Math.abs(e.clientX - (r.left + r.width / 2))
                setters[i](-Math.max(0, 1 - d / (r.width * 1.4)) * r.height * 0.16)
              })
            const leave = () => setters.forEach((fn) => fn(0))
            word.addEventListener("pointermove", move)
            word.addEventListener("pointerleave", leave)
            cleanups.push(() => {
              word.removeEventListener("pointermove", move)
              word.removeEventListener("pointerleave", leave)
            })
          }
          $$("[data-magnetic]").forEach((b) => {
            const xTo = gsap.quickTo(b, "x", { duration: 0.5, ease: "power3" })
            const yTo = gsap.quickTo(b, "y", { duration: 0.5, ease: "power3" })
            const move = (e: PointerEvent) => {
              const r = b.getBoundingClientRect()
              xTo((e.clientX - r.left - r.width / 2) * 0.25)
              yTo((e.clientY - r.top - r.height / 2) * 0.35)
            }
            const leave = () => {
              xTo(0)
              yTo(0)
            }
            b.addEventListener("pointermove", move)
            b.addEventListener("pointerleave", leave)
            cleanups.push(() => {
              b.removeEventListener("pointermove", move)
              b.removeEventListener("pointerleave", leave)
            })
          })
          return () => cleanups.forEach((fn) => fn())
        })

        // Las animaciones se crearon por tipo, no en el orden de la página: se ordenan para que la sección fija
        // (la frase grande) empuje bien a todo lo que viene debajo. Las letras cargan después: se recalcula al final.
        ScrollTrigger.sort()
        ScrollTrigger.refresh()
        void document.fonts?.ready.then(() => ScrollTrigger.refresh())
        return () => marqueeCleanups.forEach((fn) => fn())
      })
    },
    { dependencies: [pathname], revertOnUpdate: true },
  )

  return null
}
