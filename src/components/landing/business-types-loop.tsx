const TYPES = [
  "Almacenes",
  "Restaurantes",
  "Botillerías",
  "Peluquerías",
  "Ferias",
  "Cafeterías",
  "Panaderías",
  "Ferreterías",
  "Tiendas de ropa",
  "Talleres",
]

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-12 pr-12">
      {TYPES.map((label) => (
        <li key={label} className="text-[15px] font-medium whitespace-nowrap text-deep-foreground/90">
          {label}
        </li>
      ))}
    </ul>
  )
}

/** Los rubros para los que sirve OrdenSimple, pasando suave debajo de la portada. Solo CSS. */
export function BusinessTypesLoop() {
  return (
    <section aria-label="Negocios que pueden usar OrdenSimple" className="group overflow-hidden bg-deep py-4">
      <div data-marquee className="flex w-max animate-[rubros_55s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:flex-wrap">
        <Row />
        <Row hidden />
      </div>
    </section>
  )
}
