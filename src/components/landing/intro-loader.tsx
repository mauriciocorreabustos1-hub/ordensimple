import { LogoMark } from "@/components/app/logo"

/**
 * Pantalla de entrada de la portada, solo la primera vez que alguien abre el sitio en la sesión (la activa el
 * script del layout con la clase "intro"). Es solo CSS: el número sube hasta 100, se subraya a lápiz y la
 * pantalla se levanta como una persiana. Con "reducir movimiento" no aparece.
 */
export function IntroLoader() {
  return (
    <div aria-hidden className="intro-loader">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="intro-mark size-16" />
        <p className="font-display text-2xl font-semibold tracking-tight">Abriendo el negocio</p>
        <svg viewBox="0 0 220 12" className="h-3 w-56 text-[#f2a649]" fill="none">
          <path className="intro-line" d="M4 8 C 60 2 120 11 216 5" pathLength={1} stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="tabular font-mono text-sm text-deep-foreground/70">
          <span className="intro-count" /> %
        </p>
      </div>
    </div>
  )
}
