"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bell, BellOff, Check, ChefHat, Maximize } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { markKitchenReady } from "@/server/actions/comandas"

/** Dirección de avisos de este aparato (si los activó), para no avisarle a la cocina lo que ella misma marcó. */
async function thisDevice() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/")
    return (await reg?.pushManager.getSubscription())?.endpoint
  } catch {
    return undefined
  }
}

export type KitchenTicket = {
  id: string
  label: string
  /** Desde cuándo espera lo más antiguo que falta. */
  since: string
  items: { id: string; description: string; quantity: number; note: string; since: string }[]
}

const REFRESH_MS = 8_000

function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
}

const SOUND_KEY = "ordensimple-cocina-sonido"

/**
 * Aviso de pedido nuevo: tres tonos fuertes tipo timbre, para oírse en una cocina con ruido.
 * Solo suena si la cocina activó el sonido (el navegador exige tocar la pantalla una vez).
 */
function beep(ctx: AudioContext) {
  // Si el navegador pausó el audio (pantalla bloqueada, pestaña en segundo plano), se reanuda.
  if (ctx.state === "suspended") void ctx.resume()
  const t0 = ctx.currentTime + 0.05
  ;[988, 1319, 988].forEach((freq, i) => {
    const start = t0 + i * 0.22
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "square"
    o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(0.35, start + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
    o.connect(g).connect(ctx.destination)
    o.start(start)
    o.stop(start + 0.2)
  })
}

export function KitchenBoard({ tickets }: { tickets: KitchenTicket[] }) {
  const router = useRouter()
  const [now, setNow] = React.useState(() => Date.now())
  // Platos que se acaban de marcar listos: se esconden al tiro, sin esperar al servidor.
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set())
  const [sound, setSound] = React.useState<AudioContext | null>(null)
  // Si la cocina tenía el sonido activado antes, se le recuerda volver a activarlo (el navegador lo apaga al recargar).
  const [wantedSound, setWantedSound] = React.useState(false)
  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia guardada en este dispositivo, solo se lee al abrir
      setWantedSound(localStorage.getItem(SOUND_KEY) === "1")
    } catch {}
  }, [])

  function toggleSound() {
    if (sound) {
      void sound.close()
      setSound(null)
      setWantedSound(false)
      try {
        localStorage.removeItem(SOUND_KEY)
      } catch {}
      return
    }
    const ctx = new AudioContext()
    beep(ctx)
    setSound(ctx)
    try {
      localStorage.setItem(SOUND_KEY, "1")
    } catch {}
  }

  // Se actualiza sola: así llegan los pedidos nuevos sin recargar.
  React.useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now())
      router.refresh()
    }, REFRESH_MS)
    return () => clearInterval(t)
  }, [router])

  // Lo que llega nuevo (un plato nuevo, o más unidades de uno que ya estaba): se destaca y suena el aviso.
  // Cada plato se reconoce por su id y la hora en que se envió por última vez.
  const keyOf = (i: KitchenTicket["items"][number]) => `${i.id}@${i.since}`
  const allKeys = tickets.flatMap((t) => t.items.map(keyOf))
  const [known, setKnown] = React.useState(() => new Set(allKeys))
  const [fresh, setFresh] = React.useState<Set<string>>(() => new Set())
  const [arrivals, setArrivals] = React.useState(0)
  const [lastTickets, setLastTickets] = React.useState(tickets)
  if (lastTickets !== tickets) {
    setLastTickets(tickets)
    const arrived = tickets.flatMap((t) => t.items).filter((i) => !known.has(keyOf(i)))
    if (arrived.length) {
      setKnown(new Set([...known, ...arrived.map(keyOf)]))
      setFresh(new Set([...fresh, ...arrived.map((i) => i.id)]))
      setArrivals((n) => n + 1)
    }
  }
  // Suena una vez por cada tanda de pedidos que llega.
  React.useEffect(() => {
    if (arrivals && sound) beep(sound)
  }, [arrivals, sound])
  const freshCount = fresh.size
  React.useEffect(() => {
    if (!freshCount) return
    const t = setTimeout(() => setFresh(new Set()), 45_000)
    return () => clearTimeout(t)
  }, [freshCount])

  async function ready(target: { itemId?: string; comandaId?: string }, ids: string[], label: string) {
    setHidden((h) => new Set([...h, ...ids]))
    const r = await markKitchenReady(target, false, await thisDevice())
    if (!r.ok) {
      setHidden((h) => new Set([...h].filter((id) => !ids.includes(id))))
      toast.error(r.message)
      return
    }
    toast.success(`${label}: listo`, {
      action: {
        label: "Deshacer",
        onClick: async () => {
          const u = await markKitchenReady(target, true)
          if (!u.ok) return toast.error(u.message)
          setHidden((h) => new Set([...h].filter((id) => !ids.includes(id))))
          router.refresh()
        },
      },
    })
    router.refresh()
  }

  const visible = tickets.map((t) => ({ ...t, items: t.items.filter((i) => !hidden.has(i.id)) })).filter((t) => t.items.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">
          {visible.length ? `${visible.length} pedido${visible.length === 1 ? "" : "s"} por preparar` : "Sin pedidos pendientes"} · se actualiza solo
        </p>
        <Button variant={sound ? "outline" : wantedSound ? "default" : "outline"} onClick={toggleSound}>
          {sound ? <Bell /> : <BellOff />}
          {sound ? "Sonido activado" : wantedSound ? "Toca para reactivar el sonido" : "Activar sonido"}
        </Button>
        <Button variant="outline" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => null)}>
          <Maximize />
          Pantalla completa
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ChefHat className="size-6" />
          </span>
          <p className="font-medium">Todo al día</p>
          <p className="max-w-sm text-sm text-muted-foreground">Cuando el garzón toque «Enviar a cocina» en una comanda, el pedido aparecerá aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => {
            const min = minutesSince(t.since, now)
            return (
              <section
                key={t.id}
                className={cn(
                  "flex flex-col overflow-hidden rounded-2xl border-2 bg-card shadow-sm",
                  min >= 25 ? "border-red-400" : min >= 15 ? "border-amber-400" : "border-border",
                )}
              >
                <header
                  className={cn(
                    "flex items-baseline justify-between gap-2 px-4 py-3",
                    min >= 25 ? "bg-red-50 dark:bg-red-500/10" : min >= 15 ? "bg-amber-50 dark:bg-amber-500/10" : "bg-muted/50",
                  )}
                >
                  <h2 className="font-display text-2xl leading-tight font-semibold">{t.label}</h2>
                  <span className={cn("tabular text-sm font-medium", min >= 25 ? "text-red-700 dark:text-red-400" : min >= 15 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                    {min < 1 ? "recién" : `${min} min`}
                  </span>
                </header>
                <ul className="flex-1 divide-y">
                  {t.items.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => void ready({ itemId: i.id }, [i.id], `${i.quantity} × ${i.description}`)}
                        className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50", fresh.has(i.id) && "bg-primary/5")}
                        aria-label={`Marcar listo: ${i.quantity} ${i.description}`}
                      >
                        <span className="tabular w-8 shrink-0 text-xl font-bold">{i.quantity}×</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-lg leading-snug font-medium">{i.description}</span>
                          {i.note ? <span className="mt-0.5 block text-base font-semibold text-amber-700 dark:text-amber-400">{i.note}</span> : null}
                        </span>
                        {fresh.has(i.id) ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Nuevo</span> : null}
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border text-muted-foreground">
                          <Check className="size-4" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t p-3">
                  <Button
                    size="lg"
                    className="h-12 w-full text-base"
                    onClick={() => void ready({ comandaId: t.id }, t.items.map((i) => i.id), t.label)}
                  >
                    <Check />
                    Todo listo
                  </Button>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
