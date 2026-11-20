"use client";

import * as React from "react";
import { gsap } from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { LogoMark } from "@/components/app/logo";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrambleTextPlugin, ScrollTrigger, useGSAP);

// Avisos de ejemplo, como los que OrdenSimple manda al celular (no son datos reales).
const FEEDS = [
  [
    ["Venta registrada", "3 productos por $12.080"],
    ["Pedido de tu tienda", "2 productos por $15.990"],
    ["Fiado al día", "Rosa abonó $5.000"],
  ],
  [
    ["Stock bajo", "Quedan 4 de Leche entera 1L"],
    ["Reserva nueva", "Mañana 10:30, corte de pelo"],
    ["Caja cuadrada", "Te quedó $230.000 hoy"],
  ],
] as const;

/**
 * Dos avisos flotando junto al comprobante de la portada. Mientras la portada está a la vista, cambian solos
 * cada pocos segundos y sus letras se revuelven antes de asentarse. Con "reducir movimiento" quedan quietos.
 */
export function HeroNotices() {
  const root = React.useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const cards = gsap.utils.toArray<HTMLElement>(
          "[data-notice]",
          root.current,
        );
        let step = 0;
        const cycle = () => {
          step++;
          cards.forEach((card, i) => {
            const [title, text] = FEEDS[i][step % FEEDS[i].length];
            const delay = i * 0.6;
            gsap.fromTo(
              card,
              { scale: 1 },
              {
                scale: 1.04,
                duration: 0.18,
                yoyo: true,
                repeat: 1,
                delay,
                ease: "power2.out",
              },
            );
            gsap.to(card.querySelector("[data-notice-title]"), {
              scrambleText: { text: title, chars: "lowerCase", speed: 0.6 },
              duration: 0.8,
              delay,
            });
            gsap.to(card.querySelector("[data-notice-text]"), {
              scrambleText: { text, chars: "0123456789$", speed: 0.5 },
              duration: 1.1,
              delay: delay + 0.1,
            });
          });
        };
        let timer: ReturnType<typeof setInterval> | undefined;
        const hero = root.current?.closest("[data-hero]");
        ScrollTrigger.create({
          trigger: hero ?? root.current,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => {
            clearInterval(timer);
            if (self.isActive) timer = setInterval(cycle, 3800);
          },
        });
        return () => clearInterval(timer);
      });
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20"
    >
      <Notice
        index={0}
        className="top-[24%] -right-1 [--d:1.5s] sm:right-2 lg:-right-14"
        depth={1.6}
      />
      <Notice
        index={1}
        className="-bottom-[2%] -left-1 [--d:1.8s] sm:left-2 lg:-left-16"
        depth={2.2}
      />
    </div>
  );
}

function Notice({
  index,
  className,
  depth,
}: {
  index: 0 | 1;
  className?: string;
  depth: number;
}) {
  const [title, text] = FEEDS[index][0];
  return (
    <div data-hero-float={depth} className={cn("absolute", className)}>
      <div data-hero-notice className="w-[15rem]">
        {/* La inclinación va en su propia capa: GSAP mueve las otras y no la pisa. */}
        <div className={index === 0 ? "rotate-[2deg]" : "-rotate-[2deg]"}>
          <div
            data-notice
            className="flex items-start gap-2.5 rounded-2xl border border-foreground/10 bg-card/95 p-3 shadow-xl backdrop-blur"
          >
            <LogoMark className="size-7 rounded-md" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="flex items-baseline justify-between gap-2">
                <span
                  data-notice-title
                  className="truncate text-[13px] font-semibold"
                >
                  {title}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  ahora
                </span>
              </p>
              <p
                data-notice-text
                className="mt-0.5 truncate text-[12px] text-muted-foreground"
              >
                {text}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
