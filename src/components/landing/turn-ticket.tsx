import Link from "next/link"

/**
 * Cuántos somos, como el número de atención de un almacén: el próximo número (el de quien está mirando la
 * página) en grande, y cuántas personas ya lo usan. Todo el ticket lleva a crear la cuenta.
 */
export function TurnTicket({ users }: { users: number }) {
  const next = users + 1
  const number = next < 1000 ? String(next).padStart(3, "0") : next.toLocaleString("es-CL")
  return (
    <Link
      href="/registro"
      className="group inline-block w-fit -rotate-2 drop-shadow-lg transition-transform duration-200 hover:rotate-0 focus-visible:rotate-0 motion-reduce:transition-none"
      aria-label={`Ya somos ${users} personas usando OrdenSimple. Crea tu cuenta: serías el número ${next}.`}
    >
      {/* Muescas a los costados, como los tickets de la máquina de turnos (ver .ticket-notch). */}
      <div className="ticket-notch flex items-stretch bg-[#fbfaf6] text-[#13201c]">
        <div className="flex flex-col justify-center border-r-2 border-dashed border-[#13201c]/20 py-3 pr-4 pl-5">
          <span className="font-mono text-[11px] text-[#5b6b66]">Su número</span>
          <span className="font-mono tabular text-4xl leading-none font-bold tracking-tight text-[#007653] sm:text-5xl">
            N°{number}
          </span>
        </div>
        <div className="flex max-w-[13rem] flex-col justify-center gap-0.5 py-3 pr-5 pl-4 text-sm">
          <span>
            Ya somos <strong className="tabular">{users.toLocaleString("es-CL")}</strong> ordenando su negocio.
          </span>
          <span className="font-medium text-[#007653] group-hover:underline">El próximo número es el tuyo</span>
        </div>
      </div>
    </Link>
  )
}
