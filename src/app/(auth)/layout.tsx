import { Logo } from "@/components/app/logo"

// Datos de ejemplo para la boleta (no son datos reales).
const PAYMENTS = [
  { label: "Efectivo", value: "$182.400" },
  { label: "Débito y crédito", value: "$121.600" },
  { label: "Transferencias", value: "$46.000" },
]

/** El cierre de caja de un día cualquiera, como una boleta: lo que el negocio ve al final del día. */
function ClosingReceipt() {
  return (
    <div className="mx-auto w-full max-w-[19rem] -rotate-2 drop-shadow-2xl" aria-hidden>
      <div className="receipt-edge bg-[#fbfaf6] px-6 pt-6 pb-9 font-mono text-[13px] text-[#13201c]">
        <div className="space-y-0.5 text-center">
          <p className="text-sm font-semibold">Cierre de caja</p>
          <p className="text-[11px] text-[#5b6b66]">Almacén Don Pedro · 21:00</p>
        </div>
        <div className="my-4 space-y-1.5 border-y border-dashed border-[#13201c]/25 py-4">
          {PAYMENTS.map((p) => (
            <p key={p.label} className="flex items-baseline">
              <span>{p.label}</span>
              <span className="mx-2 flex-1 -translate-y-[3px] border-b border-dotted border-[#13201c]/30" />
              <span className="tabular">{p.value}</span>
            </p>
          ))}
          <p className="flex items-baseline pt-1 font-semibold">
            <span>Vendiste</span>
            <span className="mx-2 flex-1" />
            <span className="tabular">$350.000</span>
          </p>
          <p className="flex items-baseline text-[#5b6b66]">
            <span>Gastos del día</span>
            <span className="mx-2 flex-1" />
            <span className="tabular">−$120.000</span>
          </p>
        </div>
        <p className="flex justify-between text-base font-semibold">
          <span>Te quedó</span>
          <span className="tabular text-[#007653]">$230.000</span>
        </p>
        <p className="mt-5 flex justify-center">
          <span className="-rotate-6 rounded border-2 border-[#007653] px-2.5 py-0.5 text-xs font-bold tracking-wide text-[#007653]">
            CUADRA ✓
          </span>
        </p>
      </div>
    </div>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <Logo className="self-center lg:self-start" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Panel de marca: verde oscuro liso (el de las franjas de la portada) con el cierre de caja del día. */}
      <div className="hidden bg-deep text-deep-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="flex flex-1 items-center justify-center py-8">
          <ClosingReceipt />
        </div>
        <div className="max-w-md space-y-4">
          <p className="font-display text-3xl leading-[1.1] font-semibold tracking-tight text-balance xl:text-4xl">
            Cierras la caja en un minuto y sabes cuánto ganaste.
          </p>
          <p className="text-deep-foreground/75">Ventas, gastos, fiado y productos, desde el celular. Sin planillas ni fórmulas.</p>
        </div>
      </div>
    </div>
  )
}
