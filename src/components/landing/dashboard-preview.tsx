import { PiggyBank, Receipt, ShoppingBag } from "lucide-react"

// Vista ilustrativa del producto con datos de ejemplo (no son datos reales).
const BARS = [
  { d: "Lun", s: 62, e: 28 },
  { d: "Mar", s: 48, e: 34 },
  { d: "Mié", s: 74, e: 22 },
  { d: "Jue", s: 58, e: 40 },
  { d: "Vie", s: 88, e: 30 },
  { d: "Sáb", s: 96, e: 36 },
  { d: "Hoy", s: 70, e: 24 },
]

export function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-3xl" aria-label="Vista previa del panel de OrdenSimple con datos de ejemplo" role="img">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-b from-primary/20 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">
        <div className="flex items-center gap-1.5 border-b bg-muted/50 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="ml-3 text-xs text-muted-foreground">ordensimple.cl/dashboard</span>
        </div>
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm">
            <span aria-hidden>🟢</span>
            <span className="font-medium">Vas bien.</span>
            <span className="hidden text-muted-foreground sm:inline">Tus ventas cubren tus gastos este mes.</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "Ventas hoy", value: "$350.000", icon: ShoppingBag, tone: "bg-chart-1/15 text-chart-1" },
              { label: "Gastos", value: "$120.000", icon: Receipt, tone: "bg-chart-2/15 text-chart-2" },
              { label: "Ganancia aprox.", value: "$230.000", icon: PiggyBank, tone: "bg-chart-3/15 text-chart-3" },
            ].map((s) => (
              <div key={s.label} className="space-y-2 rounded-xl border p-2.5 sm:p-3">
                <div className="flex items-center gap-1.5">
                  <span className={`flex size-6 items-center justify-center rounded-md ${s.tone}`}>
                    <s.icon className="size-3.5" />
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground sm:text-xs">{s.label}</span>
                </div>
                <p className="tabular text-sm font-semibold sm:text-xl">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium sm:text-sm">Últimos 7 días</p>
              <div className="flex gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-sm bg-chart-1" /> Ventas
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-sm bg-chart-2" /> Gastos
                </span>
              </div>
            </div>
            <div className="flex h-28 items-end gap-2 sm:h-36 sm:gap-4">
              {BARS.map((b) => (
                <div key={b.d} className="flex h-full flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end justify-center gap-[2px]">
                    <div className="w-full max-w-4 rounded-t bg-chart-1" style={{ height: `${b.s}%` }} />
                    <div className="w-full max-w-4 rounded-t bg-chart-2" style={{ height: `${b.e}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{b.d}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
              Registrar venta
            </div>
            <div className="flex h-11 items-center justify-center rounded-xl border-2 text-sm font-semibold">
              Registrar gasto
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
