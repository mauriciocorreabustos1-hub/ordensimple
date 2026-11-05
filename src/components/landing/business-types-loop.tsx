import { Coffee, Croissant, Hammer, Scissors, Shirt, ShoppingBasket, Store, UtensilsCrossed, Wine, Wrench } from "lucide-react"

const TYPES = [
  { icon: ShoppingBasket, label: "Almacenes" },
  { icon: UtensilsCrossed, label: "Restaurantes" },
  { icon: Wine, label: "Botillerías" },
  { icon: Scissors, label: "Peluquerías" },
  { icon: Store, label: "Ferias" },
  { icon: Coffee, label: "Cafeterías" },
  { icon: Croissant, label: "Panaderías" },
  { icon: Hammer, label: "Ferreterías" },
  { icon: Shirt, label: "Tiendas de ropa" },
  { icon: Wrench, label: "Talleres" },
]

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-11 pr-11">
      {TYPES.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-2 text-[15px] font-medium whitespace-nowrap text-muted-foreground">
          <Icon className="size-4.5 text-primary" aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  )
}

/** Los rubros para los que sirve OrdenSimple, pasando suave debajo de la portada. Solo CSS: no agrega código al celular. */
export function BusinessTypesLoop() {
  return (
    <section aria-label="Negocios que pueden usar OrdenSimple" className="group overflow-hidden border-b bg-background py-5 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
      <div className="flex w-max animate-[rubros_55s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:flex-wrap">
        <Row />
        <Row hidden />
      </div>
    </section>
  )
}
