"use client"

import * as React from "react"
import { Check, Pause, PiggyBank, Play, Receipt, ScanLine, ShoppingBag } from "lucide-react"
import { cn } from "@/lib/utils"

// Vista ilustrativa del producto con datos de ejemplo (no son datos reales).
// Se anima como un video corto: alguien registra una venta escaneando y los números del día suben.
const BARS = [
  { d: "Lun", s: 62, e: 28 },
  { d: "Mar", s: 48, e: 34 },
  { d: "Mié", s: 74, e: 22 },
  { d: "Jue", s: 58, e: 40 },
  { d: "Vie", s: 88, e: 30 },
  { d: "Sáb", s: 96, e: 36 },
]

const ITEMS = [
  { name: "Coca-Cola 1.5L", qty: 2, total: 3_980 },
  { name: "Pan amasado (kg)", qty: 1, total: 2_400 },
  { name: "Queso gauda 250g", qty: 1, total: 3_290 },
  { name: "Huevos (docena)", qty: 1, total: 3_990 },
]
const SALE = ITEMS.reduce((t, i) => t + i.total, 0)
const BASE = { sales: 350_000, expenses: 120_000 }

/** Pasos del "video" y cuánto dura cada uno (ms). */
const STEPS = [
  { id: "idle", ms: 1400 },
  { id: "aim-sale", ms: 650 },
  { id: "press-sale", ms: 450 },
  { id: "scan-1", ms: 900 },
  { id: "scan-2", ms: 900 },
  { id: "scan-3", ms: 900 },
  { id: "scan-4", ms: 900 },
  { id: "aim-save", ms: 650 },
  { id: "press-save", ms: 450 },
  { id: "saved", ms: 4200 },
] as const
type Step = (typeof STEPS)[number]["id"]

const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL")

function useCountUp(target: number, run: boolean) {
  const [value, setValue] = React.useState(target)
  const from = React.useRef(target)
  React.useEffect(() => {
    // Al volver a empezar (o en pausa) el número salta; solo se anima cuando sube.
    if (!run || target < from.current) {
      from.current = target
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target)
      return
    }
    const start = performance.now()
    const begin = from.current
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(begin + (target - begin) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run])
  return value
}

/** Puntero que aparece y "hace clic" sobre un botón. */
function Pointer({ show }: { show: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute right-6 -bottom-3 z-10 transition-all duration-500 ease-out motion-reduce:hidden",
        show ? "translate-x-0 translate-y-0 opacity-100" : "translate-x-8 translate-y-8 opacity-0",
      )}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow-md">
        <path d="M4 2l15 9-6.5 1.5L16 20l-3 1.5-3.5-7.5L4 18z" fill="white" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function DashboardPreview() {
  const root = React.useRef<HTMLDivElement>(null)
  const [step, setStep] = React.useState<Step>("idle")
  const [visible, setVisible] = React.useState(false)
  const [paused, setPaused] = React.useState(false)
  const [reduced, setReduced] = React.useState(false)
  const playing = visible && !paused && !reduced

  // Solo se mueve cuando se ve en pantalla, y nunca si la persona pidió menos movimiento.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    const el = root.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Da dos vueltas y se detiene, para no gastar batería mientras la persona lee; con play vuelve a empezar.
  const loops = React.useRef(0)
  React.useEffect(() => {
    if (!playing) return
    const i = STEPS.findIndex((s) => s.id === step)
    const timer = setTimeout(() => {
      if (i === STEPS.length - 1 && ++loops.current >= 2) {
        loops.current = 0
        setPaused(true)
        return
      }
      setStep(STEPS[(i + 1) % STEPS.length].id)
    }, STEPS[i].ms)
    return () => clearTimeout(timer)
  }, [step, playing])

  const idx = STEPS.findIndex((s) => s.id === step)
  const at = (id: Step) => idx >= STEPS.findIndex((s) => s.id === id)
  const modalOpen = at("press-sale") && !at("saved")
  const scanned = step.startsWith("scan-") ? Number(step.slice(5)) : at("aim-save") ? ITEMS.length : 0
  const saved = step === "saved"
  const running = scanned ? ITEMS.slice(0, scanned).reduce((t, i) => t + i.total, 0) : 0

  const sales = useCountUp(BASE.sales + (saved ? SALE : 0), playing)
  const profit = sales - BASE.expenses
  const todayBar = saved ? 79 : 70

  return (
    <div
      ref={root}
      className="relative mx-auto w-full max-w-3xl"
      aria-label="Vista previa del panel de OrdenSimple con datos de ejemplo: se registra una venta escaneando productos y suben las ventas y la ganancia del día."
      role="img"
    >
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-b from-primary/20 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-xl">
        <div className="flex items-center gap-1.5 border-b bg-muted/50 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="ml-3 text-xs text-muted-foreground">ordensimple.cl/dashboard</span>
          {reduced ? null : (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="ml-auto flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              aria-label={paused ? "Reproducir animación" : "Pausar animación"}
            >
              {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
            </button>
          )}
        </div>

        <div className="space-y-4 p-4 sm:p-6" aria-hidden>
          <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm">
            <span>🟢</span>
            <span className="font-medium">Vas bien.</span>
            <span className="hidden text-muted-foreground sm:inline">Tus ventas cubren tus gastos este mes.</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "Ventas hoy", short: "Ventas", value: sales, icon: ShoppingBag, tone: "bg-chart-1/15 text-chart-1", up: true },
              { label: "Gastos", short: "Gastos", value: BASE.expenses, icon: Receipt, tone: "bg-chart-2/15 text-chart-2", up: false },
              { label: "Ganancia aprox.", short: "Ganancia", value: profit, icon: PiggyBank, tone: "bg-chart-3/15 text-chart-3", up: true },
            ].map((s) => (
              <div
                key={s.label}
                className={cn(
                  "space-y-2 rounded-xl border p-2.5 transition-colors duration-700 sm:p-3",
                  saved && s.up ? "border-success/40 bg-success/5" : "",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`flex size-6 items-center justify-center rounded-md ${s.tone}`}>
                    <s.icon className="size-3.5" />
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground sm:text-xs">
                    <span className="sm:hidden">{s.short}</span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </span>
                </div>
                <p className="tabular text-sm font-semibold sm:text-xl">{clp(s.value)}</p>
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
              {[...BARS, { d: "Hoy", s: todayBar, e: 24 }].map((b) => (
                <div key={b.d} className="flex h-full flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end justify-center gap-[2px]">
                    <div
                      className="w-full max-w-4 rounded-t bg-chart-1 transition-[height] duration-700 ease-out"
                      style={{ height: `${b.s}%` }}
                    />
                    <div className="w-full max-w-4 rounded-t bg-chart-2" style={{ height: `${b.e}%` }} />
                  </div>
                  <span className={cn("text-[10px] text-muted-foreground", b.d === "Hoy" && saved ? "font-semibold text-foreground" : "")}>
                    {b.d}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div
              className={cn(
                "relative flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-transform duration-150",
                step === "press-sale" ? "scale-[0.96]" : "",
              )}
            >
              Registrar venta
              <Pointer show={step === "aim-sale" || step === "press-sale"} />
            </div>
            <div className="flex h-11 items-center justify-center rounded-xl border-2 text-sm font-semibold">Registrar gasto</div>
          </div>
        </div>

        {/* Ventana "Registrar venta" que sube desde abajo, como en el celular. */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 top-10 flex items-end bg-foreground/25 transition-opacity duration-300",
            modalOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full max-w-md space-y-3 rounded-t-2xl border bg-card p-4 shadow-2xl transition-transform duration-500 ease-out sm:p-5",
              modalOpen ? "translate-y-0" : "translate-y-full",
            )}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">Registrar venta</p>
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  scanned && scanned < ITEMS.length ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <ScanLine className="size-3.5" />
                Escanear
              </span>
            </div>
            <ul className="min-h-[9.5rem] space-y-1.5 text-sm">
              {ITEMS.map((it, i) => (
                <li
                  key={it.name}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-all duration-300",
                    i < scanned ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                    i === scanned - 1 && step.startsWith("scan-") ? "border-primary/50 bg-primary/5" : "",
                  )}
                >
                  <Check className="size-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate">{it.name}</span>
                  <span className="tabular text-muted-foreground">×{it.qty}</span>
                  <span className="tabular w-16 text-right font-medium">{clp(it.total)}</span>
                </li>
              ))}
            </ul>
            <div
              className={cn(
                "relative flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-transform duration-150",
                step === "press-save" ? "scale-[0.96]" : "",
              )}
            >
              <span className="tabular">Guardar venta · {clp(running)}</span>
              <Pointer show={step === "aim-save" || step === "press-save"} />
            </div>
          </div>
        </div>

        {/* Aviso de venta guardada */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-5 flex justify-center transition-all duration-500 ease-out sm:bottom-7",
            saved ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
          )}
        >
          <span className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-lg">
            <span className="flex size-5 items-center justify-center rounded-full bg-success text-white">
              <Check className="size-3" />
            </span>
            <span className="tabular">Venta de {clp(SALE)} guardada</span>
          </span>
        </div>
      </div>
    </div>
  )
}
