import { AlertTriangle, ArrowUpRight, CheckCircle2, ShoppingBag } from "lucide-react"
import { Logo } from "@/components/app/logo"

const points = [
  "Registra una venta en menos de 10 segundos",
  "Sabe cuánto ganas, sin fórmulas ni Excel",
  "Calculadoras para poner precios y metas",
]

// Datos de ejemplo para la ilustración (no son datos reales).
const BARS = [38, 52, 44, 66, 58, 82, 70]

/** Ilustración de la app: tarjetas flotantes con datos de ejemplo. */
function AppIllustration() {
  return (
    <div className="relative mx-auto h-[340px] w-full max-w-md" aria-hidden>
      {/* Tarjeta principal: ventas de hoy + gráfico */}
      <div className="absolute top-6 left-1/2 w-[300px] -translate-x-1/2 -rotate-2 rounded-2xl bg-white p-5 text-[#13201c] shadow-2xl shadow-black/25">
        <div className="flex items-center gap-2 text-xs text-[#5b6b66]">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#007653]/10 text-[#007653]">
            <ShoppingBag className="size-3.5" />
          </span>
          Ventas hoy
        </div>
        <div className="mt-2 flex items-end justify-between">
          <p className="text-3xl font-semibold tracking-tight">$350.000</p>
          <span className="mb-1 inline-flex items-center gap-0.5 rounded-full bg-[#007653]/10 px-2 py-0.5 text-xs font-medium text-[#007653]">
            <ArrowUpRight className="size-3" />
            12%
          </span>
        </div>
        <div className="mt-4 flex h-20 items-end gap-2">
          {BARS.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md"
              style={{ height: `${h}%`, background: i === BARS.length - 1 ? "#007653" : "#007653" + "33" }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-[#5b6b66]">
          {["L", "M", "M", "J", "V", "S", "Hoy"].map((d, i) => (
            <span key={i} className="flex-1 text-center">
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* Estado del negocio */}
      <div className="absolute top-0 -right-2 rotate-3 rounded-xl bg-white px-4 py-3 text-sm text-[#13201c] shadow-xl shadow-black/20 xl:right-0">
        <p className="flex items-center gap-2 font-semibold">
          <span className="size-2.5 rounded-full bg-[#1f9d55]" />
          Vas bien
        </p>
        <p className="text-xs text-[#5b6b66]">Te quedó $230.000 hoy</p>
      </div>

      {/* Aviso de stock */}
      <div className="absolute bottom-6 -left-2 -rotate-1 rounded-xl bg-white px-4 py-3 text-sm text-[#13201c] shadow-xl shadow-black/20 xl:left-0">
        <p className="flex items-center gap-2 text-xs font-semibold text-[#b26a12]">
          <AlertTriangle className="size-3.5" />
          Por reponer
        </p>
        <p className="mt-0.5 text-xs">Te quedan 4 unidades de Coca-Cola 1.5L</p>
      </div>

      {/* Botón de registro rápido */}
      <div className="absolute right-4 bottom-0 rotate-2 rounded-xl bg-[#f2a649] px-4 py-2.5 text-sm font-semibold text-[#3d2604] shadow-xl shadow-black/20">
        + Registrar venta
      </div>
    </div>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <Logo className="self-start" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Panel de marca: mismo verde en tema claro y oscuro */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#008a61] via-[#007653] to-[#004d36] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-[#f2a649]/20 blur-3xl" />

        <div className="relative flex flex-1 items-center justify-center py-8">
          <AppIllustration />
        </div>

        <div className="relative space-y-6">
          <p className="text-3xl leading-tight font-semibold tracking-tight">
            Administra tu negocio
            <br />
            sin complicarte.
          </p>
          <ul className="space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-white/90">
                <CheckCircle2 className="size-5 shrink-0 text-[#9de3c3]" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
