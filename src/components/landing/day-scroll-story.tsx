"use client"

import * as React from "react"
import { Check, Home, Menu, MessageCircle, Plus, Receipt, ShoppingBag, Wallet } from "lucide-react"
import { LogoMark } from "@/components/app/logo"
import { AnimatedTitle } from "@/components/landing/animated-title"
import { smoothScrollTo } from "@/components/landing/smooth-scroll"
import { cn } from "@/lib/utils"

// Un día en el negocio, llevado por el scroll: al deslizar corre la hora y la app se va llenando, pantalla por
// pantalla. Al subir, todo vuelve atrás. Datos de ejemplo (no son datos reales).

const STEPS = [
  { from: 0, to: 0.1, time: "08:30", title: "Abres con la cuenta en cero", text: "Cada mañana ves de un vistazo cómo parte tu día." },
  { from: 0.1, to: 0.4, time: "Mañana", title: "Cada venta se suma sola", text: "Tocas el producto o lo escaneas con la cámara. El total se actualiza y el comprobante queda listo." },
  { from: 0.4, to: 0.6, time: "14:30", title: "Anotas un gasto y sabes cuánto te queda", text: "Se descuenta al momento de lo que llevas ganado." },
  { from: 0.6, to: 0.8, time: "17:20", title: "El fiado queda a nombre del cliente", text: "Sabes quién te debe y cuánto, y le recuerdas por WhatsApp con un toque." },
  { from: 0.8, to: 1, time: "21:00", title: "Cierras la caja en un minuto", text: "Cuentas el efectivo, ves si cuadra y sabes cuánto ganaste hoy." },
]

const MOVES = [
  { at: 0.13, time: "08:52", name: "2 × Pan amasado (kg)", detail: "Efectivo", amount: "$4.800" },
  { at: 0.2, time: "10:15", name: "Café en grano 250 g", detail: "Débito", amount: "$5.990" },
  { at: 0.27, time: "11:40", name: "Leche y huevos", detail: "Transferencia", amount: "$7.240" },
  { at: 0.34, time: "12:50", name: "Detergente 3L", detail: "Crédito", amount: "$7.990" },
  { at: 0.45, time: "14:30", name: "Proveedor de bebidas", detail: "Gasto", amount: "−$18.500", expense: true },
].reverse()

const PAID = [
  ["Efectivo", "$96.320"],
  ["Débito", "$72.410"],
  ["Crédito", "$31.100"],
  ["Transferencia", "$16.250"],
  ["Fiado", "$12.000"],
]

const CUSTOMERS = [
  { initials: "JP", name: "Juan Pérez", note: "Debe $12.000", owes: true },
  { initials: "CM", name: "Carla Muñoz", note: "Frecuente" },
  { initials: "MS", name: "María Soto", note: "Frecuente" },
]

const TICKET = [
  ["2 x Pan amasado", "$4.800"],
  ["1 x Café en grano", "$5.990"],
]

// [avance del scroll, valor]: entre dos puntos, el valor cambia de a poco.
const SOLD = [[0.1, 0], [0.4, 96_400], [0.8, 187_300], [0.9, 228_080]]
const COUNT = [[0.1, 0], [0.4, 11], [0.8, 23], [0.9, 28]]
const SPENT = [[0.44, 0], [0.49, 18_500]]
// El reloj del celular coincide con la hora de cada movimiento.
const MINUTES = [[0.1, 8 * 60 + 30], [0.13, 8 * 60 + 52], [0.2, 10 * 60 + 15], [0.27, 11 * 60 + 40], [0.34, 12 * 60 + 50], [0.45, 14 * 60 + 30], [0.66, 17 * 60 + 20], [0.9, 21 * 60]]
// 0 inicio, 1 clientes, 2 caja.
const SCREEN = [[0.6, 0], [0.65, 1], [0.8, 1], [0.85, 2]]

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n))
}

function valueAt(points: number[][], p: number) {
  if (p <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    if (p <= x1) return y0 + ((p - x0) / (x1 - x0)) * (y1 - y0)
  }
  return points[points.length - 1][1]
}

function ease(t: number) {
  return 1 - (1 - t) * (1 - t) * (1 - t)
}

/** Aparece en un tramo corto del scroll. */
function reveal(p: number, at: number, span = 0.035) {
  return ease(clamp((p - at) / span))
}

/** Entra y sale: para las tarjetas que acompañan al celular. */
function during(p: number, from: number, to: number, span = 0.035) {
  return Math.min(reveal(p, from, span), 1 - reveal(p, to - span, span))
}

const money = (n: number) => "$" + (Math.round(n / 10) * 10).toLocaleString("es-CL")

function minutesAt(p: number) {
  return Math.round(valueAt(MINUTES, p))
}

function clock(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

function floatStyle(v: number, from = 18): React.CSSProperties {
  return { opacity: v, transform: `translateY(${(1 - v) * from}px) scale(${0.97 + v * 0.03})`, visibility: v <= 0.001 ? "hidden" : undefined }
}

export function DayScrollStory() {
  const root = React.useRef<HTMLElement>(null)
  const [p, setP] = React.useState(0)

  React.useEffect(() => {
    const el = root.current
    if (!el) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    let shown = 0
    let last = 0
    // El avance sigue al scroll con un pequeño retraso, calculado por tiempo: va igual en pantallas rápidas y en equipos lentos.
    const tick = (now: number) => {
      frame = 0
      if (still.matches) return setP(1)
      const box = el.getBoundingClientRect()
      const target = clamp(-box.top / (box.height - window.innerHeight))
      shown += (target - shown) * (1 - Math.exp(-(last ? now - last : 16) / 110))
      if (Math.abs(target - shown) < 0.0004) {
        shown = target
        last = 0
      } else {
        last = now
        frame = requestAnimationFrame(tick)
      }
      setP(shown)
    }
    const request = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }
    request()
    window.addEventListener("scroll", request, { passive: true })
    window.addEventListener("resize", request)
    still.addEventListener("change", request)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", request)
      window.removeEventListener("resize", request)
      still.removeEventListener("change", request)
    }
  }, [])

  function goTo(step: (typeof STEPS)[number]) {
    const el = root.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    // Un poco después del inicio del tramo, para que ya se vea lo que cuenta.
    const at = step.from + (step.to - step.from) * (step.from === 0 ? 0 : 0.6)
    smoothScrollTo(top + (el.offsetHeight - window.innerHeight) * at)
  }

  const current = Math.max(0, STEPS.findIndex((s) => p <= s.to))
  const minutes = minutesAt(p)
  const sold = valueAt(SOLD, p)
  const spent = valueAt(SPENT, p)
  const screen = valueAt(SCREEN, p)
  const greeting = minutes < 12 * 60 ? "Buenos días" : minutes < 20 * 60 ? "Buenas tardes" : "Buenas noches"

  const ticket = during(p, 0.2, 0.39)
  const expense = during(p, 0.45, 0.59)
  const reminder = during(p, 0.67, 0.79)
  const closed = reveal(p, 0.91)

  return (
    <section ref={root} aria-labelledby="dia-titulo" className="relative h-[460svh] border-y bg-background motion-reduce:h-auto">
      <div className="sticky top-0 h-svh overflow-hidden pt-16 motion-reduce:static motion-reduce:h-auto">
        <div className="mx-auto grid h-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-4 px-4 pt-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-1 lg:items-center lg:gap-16 lg:py-6">
          <div>
            <h2 id="dia-titulo" className="sr-only">
              Desliza y mira cómo se ordena tu día
            </h2>
            <div aria-hidden className="mb-8 max-lg:hidden">
              <AnimatedTitle tag="p" text="Desliza y mira cómo se ordena tu día" className="font-display text-4xl leading-[1.08] font-semibold tracking-tight text-balance" />
            </div>

            {/* En el computador se ve toda la jornada; en el celular, solo el momento actual. */}
            <ol className="relative max-lg:min-h-[7.25rem] motion-reduce:max-lg:min-h-0">
              <span aria-hidden className="absolute top-2 bottom-2 left-[5px] w-0.5 rounded-full bg-border max-lg:hidden">
                <span className="block h-full origin-top rounded-full bg-primary" style={{ transform: `scaleY(${p})` }} />
              </span>
              {STEPS.map((s, i) => {
                const active = i === current
                return (
                  <li
                    key={s.title}
                    className={cn(
                      "lg:relative lg:pl-8",
                      "max-lg:absolute max-lg:inset-x-0 max-lg:top-0 max-lg:transition-opacity max-lg:duration-300 motion-reduce:static motion-reduce:opacity-100 motion-reduce:max-lg:mb-4",
                      active ? "max-lg:opacity-100" : "max-lg:pointer-events-none max-lg:opacity-0",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-[1.15rem] left-0 size-3 rounded-full border-2 transition-colors duration-300 max-lg:hidden",
                        i <= current ? "border-primary bg-primary" : "border-border bg-background",
                      )}
                    />
                    <button
                      type="button"
                      aria-current={active ? "step" : undefined}
                      onClick={() => goTo(s)}
                      className="group w-full rounded-lg py-2.5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-lg:pt-0"
                    >
                      <span className={cn("tabular block text-sm font-medium transition-colors duration-300", active ? "text-primary" : "text-muted-foreground")}>{s.time}</span>
                      <span
                        className={cn(
                          "mt-0.5 block font-display text-xl leading-snug font-semibold text-balance transition-colors duration-300 lg:text-[1.35rem]",
                          active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        {s.title}
                      </span>
                    </button>
                    <div className={cn("grid transition-[grid-template-rows] duration-300 motion-reduce:grid-rows-[1fr]", active ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                      <p className="overflow-hidden text-[15px] leading-relaxed text-pretty text-muted-foreground lg:text-base">
                        <span className="block pb-2">{s.text}</span>
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>

          {/* El escenario: en pantallas chicas el celular se corta abajo, para que el texto siempre se lea. */}
          <div aria-hidden className="relative min-h-0 rounded-t-[2rem] bg-accent/70 max-lg:-mx-1 motion-reduce:h-[38rem] lg:h-[min(41rem,calc(100svh-7rem))] lg:rounded-[2rem]">
            <div className="absolute inset-x-0 top-6 bottom-0 mx-auto w-[min(18.5rem,82%)] lg:bottom-6">
              <div className="flex h-full flex-col overflow-hidden rounded-t-[2rem] border-[6px] border-b-0 border-foreground/90 bg-background shadow-[0_30px_60px_-20px_rgba(0,70,50,0.45)] lg:rounded-b-[2rem] lg:border-b-[6px]">
                <div className="flex items-center justify-between border-b bg-card px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight">
                    <LogoMark className="size-5" />
                    <span>
                      Orden<span className="text-primary">Simple</span>
                    </span>
                  </span>
                  <span className="tabular text-xs font-medium text-muted-foreground">{clock(minutes)}</span>
                </div>

                {/* Las tres pantallas, una al lado de la otra: el scroll las desliza. */}
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <div className="flex h-full w-[300%]" style={{ transform: `translateX(${(-screen * 100) / 3}%)` }}>
                    <div className="h-full w-1/3 overflow-hidden p-3">
                      <p className="text-[11px] text-muted-foreground">{greeting}, Pedro</p>
                      <p className="font-display text-lg leading-tight font-semibold tracking-tight">Almacén Don Pedro</p>

                      <div className="mt-2.5 rounded-xl border bg-card p-3 text-xs">
                        <p className="mb-1.5 font-semibold">Hoy</p>
                        <div className="flex items-baseline justify-between py-0.5">
                          <span className="text-muted-foreground">Vendiste</span>
                          <span className="tabular font-semibold">{money(sold)}</span>
                        </div>
                        <div className="flex items-baseline justify-between py-0.5">
                          <span className="text-muted-foreground">Gastaste</span>
                          <span className="tabular font-semibold">
                            {spent > 0 ? "−" : ""}
                            {money(spent)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between border-t pt-2">
                          <span className="font-medium">Te quedó (aprox.)</span>
                          <span className="tabular font-display text-xl leading-none font-semibold text-primary">{money(sold - spent)}</span>
                        </div>
                        <p className="tabular mt-1.5 text-[11px] text-muted-foreground">{Math.round(valueAt(COUNT, p))} ventas</p>
                      </div>

                      <div className="mt-2.5 overflow-hidden rounded-xl border bg-card">
                        {p < 0.13 ? <p className="p-3 text-xs text-muted-foreground">Tu primera venta del día aparecerá aquí.</p> : null}
                        {MOVES.map((m) => {
                          const r = reveal(p, m.at)
                          return (
                            <div key={m.time} className="overflow-hidden" style={{ height: `${r * 2.75}rem`, opacity: r }}>
                              <div className={cn("flex h-11 items-center gap-2 border-b px-3 last:border-b-0", m.expense && "bg-orange-500/10")}>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs leading-tight font-medium">{m.name}</span>
                                  <span className="tabular block text-[10px] leading-tight text-muted-foreground">
                                    {m.time}, {m.detail.toLowerCase()}
                                  </span>
                                </span>
                                <span className="tabular text-xs font-semibold">{m.amount}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="h-full w-1/3 overflow-hidden p-3">
                      <p className="font-display text-lg leading-tight font-semibold tracking-tight">Clientes</p>
                      <div className="mt-2.5 rounded-xl border bg-card p-3">
                        <p className="text-[11px] text-muted-foreground">Te deben (fiado)</p>
                        <p className="tabular font-display text-xl font-semibold">$12.000</p>
                        <p className="text-[11px] text-muted-foreground">1 cliente con deuda</p>
                      </div>
                      <div className="mt-2.5 space-y-2">
                        {CUSTOMERS.map((c) => (
                          <div key={c.name} className="flex items-center gap-2.5 rounded-xl border bg-card p-2.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">{c.initials}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">{c.name}</span>
                              <span className={cn("block text-[11px]", c.owes ? "font-medium text-orange-700 dark:text-orange-400" : "text-muted-foreground")}>{c.note}</span>
                            </span>
                            {c.owes ? (
                              <span className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium">
                                <MessageCircle className="size-3" />
                                Cobrar
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="h-full w-1/3 overflow-hidden p-3">
                      <p className="font-display text-lg leading-tight font-semibold tracking-tight">Cierre de caja</p>
                      <div className="mt-2.5 rounded-xl border bg-card px-3 py-1.5 text-xs">
                        <p className="py-1 font-semibold">¿Cómo te pagaron hoy?</p>
                        {PAID.map(([label, value]) => (
                          <div key={label} className="flex justify-between border-t py-1.5">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="tabular font-medium">{value}</span>
                          </div>
                        ))}
                        <div className="flex justify-between border-t py-1.5 font-semibold">
                          <span>Total vendido</span>
                          <span className="tabular">$228.080</span>
                        </div>
                      </div>
                      <div className="mt-2.5 rounded-xl border bg-card p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Debería haber</span>
                          <span className="tabular font-medium">$77.820</span>
                        </div>
                        <div className="mt-1 flex justify-between">
                          <span className="text-muted-foreground">Contaste</span>
                          <span className="tabular font-medium">{closed > 0.5 ? "$77.820" : "—"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center justify-around border-t bg-card px-1 py-1.5 text-[9px] text-muted-foreground">
                  {[
                    { icon: Home, label: "Inicio", on: screen < 0.5 },
                    { icon: ShoppingBag, label: "Ventas" },
                    { icon: Plus, label: "", main: true },
                    { icon: Receipt, label: "Gastos" },
                    { icon: Menu, label: "Más", on: screen >= 0.5 },
                  ].map((n) =>
                    n.main ? (
                      <span key="nuevo" className="-mt-5 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                        <n.icon className="size-4.5" />
                      </span>
                    ) : (
                      <span key={n.label} className={cn("flex w-10 flex-col items-center gap-0.5", n.on && "font-medium text-primary")}>
                        <n.icon className="size-3.5" />
                        {n.label}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>

            {/* Lo que pasa fuera de la pantalla, en el momento en que pasa. */}
            <div className="absolute top-[12%] left-1 z-10 w-40 rounded-sm bg-white p-3 font-mono text-[9.5px] leading-snug text-black shadow-xl max-lg:hidden xl:-left-10" style={floatStyle(ticket)}>
              <p className="text-center font-bold">ALMACEN DON PEDRO</p>
              <p className="text-center">Comprobante 10:15</p>
              <p className="my-1 border-t border-dashed border-neutral-400" />
              {TICKET.map(([name, price]) => (
                <p key={name} className="flex justify-between gap-1">
                  <span className="truncate">{name}</span>
                  <span>{price}</span>
                </p>
              ))}
              <p className="my-1 border-t border-dashed border-neutral-400" />
              <p className="flex justify-between font-bold">
                <span>TOTAL</span>
                <span>$10.790</span>
              </p>
              <p className="mt-1 text-center text-[8.5px]">No válido como boleta</p>
            </div>

            <div className="absolute right-2 bottom-[22%] z-10 flex w-52 items-center gap-2.5 rounded-2xl border bg-card p-3 shadow-xl lg:-right-6 lg:bottom-[34%]" style={floatStyle(expense)}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-400">
                <Receipt className="size-4" />
              </span>
              <span className="min-w-0 text-xs">
                <span className="block font-semibold">Gasto anotado</span>
                <span className="tabular block text-muted-foreground">Bebidas, −$18.500</span>
              </span>
            </div>

            <div className="absolute right-2 bottom-[14%] z-10 w-56 rounded-2xl rounded-br-sm bg-[#d9fdd3] p-3 text-xs leading-snug text-neutral-900 shadow-xl lg:-right-8 lg:bottom-[20%]" style={floatStyle(reminder)}>
              <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold text-[#128c4b]">
                <Wallet className="size-3" />
                Recordatorio para Juan
              </p>
              Hola Juan, tienes un saldo de $12.000 en Almacén Don Pedro. Puedes pagarlo con tarjeta aquí.
            </div>

            <div className="absolute right-2 bottom-[12%] z-10 flex w-52 items-center gap-2.5 rounded-2xl bg-primary p-3 text-primary-foreground shadow-xl lg:-right-6" style={floatStyle(closed)}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20">
                <Check className="size-4" />
              </span>
              <span className="text-xs">
                <span className="block font-semibold">La caja cuadra</span>
                <span className="tabular block opacity-90">Hoy te quedaron $209.580</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
