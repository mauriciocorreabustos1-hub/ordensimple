/**
 * La frase grande de la portada. Al bajar, cada palabra pasa de lápiz tenue a tinta y, al final, un círculo
 * a mano encierra la idea principal (MotionDirector, data-manifesto). En computador la sección queda fija
 * mientras se escribe. Sin JavaScript o con "reducir movimiento" se ve completa.
 */
export function Manifesto() {
  return (
    <section data-manifesto className="ruled-page overflow-x-clip">
      <div className="mx-auto flex min-h-[70svh] max-w-6xl items-center px-5 py-20 sm:px-8 lg:min-h-svh lg:pl-16">
        <p
          data-manifesto-text
          className="max-w-5xl font-display text-[length:clamp(2rem,4.6vw,4.25rem)] leading-[1.14] font-semibold tracking-tight text-balance"
        >
          Cada venta, cada fiado y cada producto que se acaba queda anotado solo. Tú atiendes a tu cliente.{" "}
          <span className="relative inline-block text-primary">
            OrdenSimple lleva la cuenta.
            <svg
              data-manifesto-circle
              aria-hidden
              viewBox="0 0 800 140"
              preserveAspectRatio="none"
              className="pointer-events-none absolute -top-[9%] -left-[4%] h-[122%] w-[108%] overflow-visible text-primary"
            >
              <path
                d="M430 10 C 640 6 794 34 790 72 C 786 112 600 132 380 130 C 170 128 8 108 12 68 C 16 30 190 8 470 12 C 540 13 600 20 636 28"
                pathLength={1}
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="1"
              />
            </svg>
          </span>
        </p>
      </div>
    </section>
  )
}
