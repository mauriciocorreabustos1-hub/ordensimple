import { ArrowUpRight, Truck } from "lucide-react"

// Aviso de FreightGo, otro sitio del mismo equipo. Con sus colores (azul y azul marino), para que se lea como lo que es:
// una recomendación de otro producto, separada de OrdenSimple.
const URL = "https://www.freightgo.cl/?utm_source=ordensimple&utm_medium=referral&utm_campaign=aviso-sitio"

export function FreightGoAd() {
  return (
    <aside aria-label="Otro proyecto de nuestro equipo: FreightGo" className="mx-auto max-w-6xl px-4 pt-12 pb-12 sm:px-6">
      <div className="grid gap-6 overflow-hidden rounded-2xl bg-white p-6 text-[#0f172a] shadow-xl sm:p-8 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-8">
        <span aria-hidden className="flex size-16 items-center justify-center rounded-2xl bg-[#0870e8] text-white">
          <Truck className="size-8" />
        </span>
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#475569]">Otro proyecto de nuestro equipo</p>
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">¿Tu negocio mueve carga? Compara fletes en FreightGo</h2>
          <p className="max-w-2xl text-pretty text-[#475569]">
            Cotiza con empresas transportistas de Chile, compara sus tarifas y elige la que más te conviene: puerto, bodega o última milla. Para empresas con RUT.
          </p>
        </div>
        <a
          href={URL}
          target="_blank"
          rel="noopener"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0870e8] px-6 font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#0660c9] focus-visible:ring-3 focus-visible:ring-[#0870e8]/40 focus-visible:outline-none"
        >
          Comparar fletes
          <ArrowUpRight className="size-4" aria-hidden />
        </a>
      </div>
    </aside>
  )
}
