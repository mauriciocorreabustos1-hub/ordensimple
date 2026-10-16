"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bell, BellOff, Check, ChefHat, Maximize } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { markKitchenReady } from "@/server/actions/comandas"

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

/** Pitido corto (solo si la cocina activó el sonido: el navegador lo exige). */
function beep(ctx: AudioContext) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.frequency.value = 880
  g.gain.setValueAtTime(0.0001, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
  o.connect(g).connect(ctx.destination)
  o.start()
  o.stop(ctx.currentTime + 0.4)
}

export function KitchenBoard({ tickets }: { tickets: KitchenTicket[] }) {
  const router = useRouter()
  const [now, setNow] = React.useState(() => Date.now())
  // Platos que se acaban de marcar listos: se esconden al tiro, sin esperar al servidor.
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set())
  const [sound, setSound] = React.useState<AudioContext | null>(null)

  // Se actualiza sola: así llegan los pedidos nuevos sin recargar.
  React.useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now())
      router.refresh()
    }, REFRESH_MS)
    return () => clearInterval(t)
  }, [router])

  // Platos nuevos (que no estaban en la vista anterior): se destacan y suena el aviso.
  const allIds = tickets.flatMap((t) => t.items.map((i) => i.id))
  const [known, setKnown] = React.useState(() => new Set(allIds))
  const [fresh, setFresh] = React.useState<Set<string>>(() => new Set())
  const [lastTickets, setLastTickets] = React.useState(tickets)
  if (lastTickets !== tickets) {
    setLastTickets(tickets)
    const arrived = allIds.filter((id) => !known.has(id))
    if (arrived.length) {
      setKnown(new Set([...known, ...arrived]))
      setFresh(new Set([...fresh, ...arrived]))
    }
  }
  const freshCount = fresh.size
  React.useEffect(() => {
    if (freshCount && sound) beep(sound)
    if (!freshCount) return
    const t = setTimeout(() => setFresh(new Set()), 45_000)
    return () => clearTimeout(t)
  }, [freshCount, sound])

  async function ready(target: { itemId?: string; comandaId?: string }, ids: string[], label: string) {
    setHidden((h) => new Set([...h, ...ids]))
    const r = await markKitchenReady(target)
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
        <Button
          variant="outline"
          onClick={() => {
            if (sound) {
              void sound.close()
              setSound(null)
            } else {
              const ctx = new AudioContext()
              beep(ctx)
              setSound(ctx)
            }
          }}
        >
          {sound ? <Bell /> : <BellOff />}
          {sound ? "Sonido activado" : "Activar sonido"}
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
