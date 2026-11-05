import { Caveat } from "next/font/google"
import { cn } from "@/lib/utils"

const hand = Caveat({ subsets: ["latin"], display: "swap", preload: false })

const LINES = [
  { text: "Pan 2.400" },
  { text: "Coca 1.990" },
  { text: "Juan fió 15.000 ??", strong: true },
  { text: "Luz 32 mil" },
  { text: "Queso... ¿cuánto era?" },
  { text: "¿Cuánto me quedó?", strong: true },
]

/** La hoja de cuaderno al lado de la app: lo que el negocio deja de hacer. Solo en pantallas grandes. */
export function HeroNotebook() {
  return (
    <div
      aria-hidden
      className={cn(
        hand.className,
        "notebook mt-10 ml-2 hidden w-72 -rotate-3 rounded-sm border bg-card pt-3.5 pr-3 pb-6 pl-12 text-[1.35rem] leading-7 text-foreground/75 shadow-lg lg:block",
      )}
    >
      {LINES.map((l) => (
        <p key={l.text} className={l.strong ? "font-bold text-danger" : undefined}>
          {l.text}
        </p>
      ))}
    </div>
  )
}
