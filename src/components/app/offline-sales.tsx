"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CloudOff, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/currency"
import type { QuickSaleInput, SaleInput } from "@/lib/validations"
import { createQuickSale, createSale } from "@/server/actions/sales"

/**
 * Ventas sin internet: si se corta la señal al guardar una venta, queda guardada en este equipo
 * y se sube sola cuando vuelve la conexión. Cada venta lleva un id propio, así nunca se duplica.
 */

type PendingSale = {
  clientId: string
  businessId: string
  savedAt: string
  total: number
  /** Si el servidor la rechazó (por ejemplo, un producto que ya no existe), el motivo. */
  error?: string
} & ({ kind: "quick"; input: QuickSaleInput } | { kind: "detail"; input: SaleInput })

const KEY = "ventas-sin-subir:v1"
const CHANGED = "ventas-sin-subir"

function readAll(): PendingSale[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    if (!Array.isArray(list)) return []
    // Una sola vez cada venta, aunque haya quedado repetida.
    return [...new Map((list as PendingSale[]).map((s) => [s.clientId, s])).values()]
  } catch {
    return []
  }
}

function writeAll(list: PendingSale[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {}
  window.dispatchEvent(new Event(CHANGED))
}

export function newClientId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  }
}

type SaveResult = { ok: true; offline: boolean; message?: string; data?: { saleId: string } } | { ok: false; message: string }

type OfflineSalesValue = {
  /** Guarda la venta: en línea va directo; sin internet queda pendiente en este equipo. */
  save: (
    sale: { kind: "quick"; input: QuickSaleInput; total: number } | { kind: "detail"; input: SaleInput; total: number },
  ) => Promise<SaveResult>
}

const OfflineSalesContext = React.createContext<OfflineSalesValue | null>(null)

export function useOfflineSales() {
  return React.useContext(OfflineSalesContext)
}

const send = (s: Pick<PendingSale, "kind" | "input">) =>
  s.kind === "quick" ? createQuickSale(s.input as QuickSaleInput) : createSale(s.input as SaleInput)

export function OfflineSalesProvider({ businessId, children }: { businessId: string; children: React.ReactNode }) {
  const value = React.useMemo<OfflineSalesValue>(
    () => ({
      async save(sale) {
        const clientId = sale.input.clientId ?? newClientId()
        const input = { ...sale.input, clientId }
        const keep = () => {
          const entry = {
            ...sale,
            input: { ...input, soldAt: new Date().toISOString() },
            clientId,
            businessId,
            savedAt: new Date().toISOString(),
          } as PendingSale
          writeAll([...readAll(), entry])
          return { ok: true as const, offline: true }
        }
        if (typeof navigator !== "undefined" && navigator.onLine === false) return keep()
        try {
          const r = await send({ kind: sale.kind, input } as PendingSale)
          return r.ok
            ? { ok: true, offline: false, message: r.message, data: r.data }
            : { ok: false, message: r.message ?? "No se pudo guardar la venta." }
        } catch {
          // No llegó al servidor (sin señal o conexión cortada): queda guardada aquí.
          return keep()
        }
      },
    }),
    [businessId],
  )
  return <OfflineSalesContext.Provider value={value}>{children}</OfflineSalesContext.Provider>
}

/** Aviso de ventas por subir (y sin conexión); las sube solo al volver internet. */
export function OfflineSalesBar({ businessId, currency }: { businessId: string; currency: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState<PendingSale[]>([])
  const [online, setOnline] = React.useState(true)
  const [syncing, setSyncing] = React.useState(false)
  const busy = React.useRef(false)

  const refresh = React.useCallback(() => setPending(readAll().filter((s) => s.businessId === businessId)), [businessId])

  const sync = React.useCallback(async () => {
    if (busy.current || navigator.onLine === false) return
    const mine = readAll().filter((s) => s.businessId === businessId && !s.error)
    if (!mine.length) return
    busy.current = true
    setSyncing(true)
    let uploaded = 0
    for (const s of mine) {
      try {
        const r = await send(s)
        const rest = readAll()
        if (r.ok) {
          uploaded++
          writeAll(rest.filter((x) => x.clientId !== s.clientId))
        } else {
          writeAll(rest.map((x) => (x.clientId === s.clientId ? { ...x, error: r.message ?? "No se pudo guardar." } : x)))
        }
      } catch {
        break // Todavía sin conexión: se reintenta más tarde.
      }
    }
    busy.current = false
    setSyncing(false)
    if (uploaded) {
      toast.success(
        uploaded === 1 ? "Se subió la venta que guardaste sin internet." : `Se subieron ${uploaded} ventas que guardaste sin internet.`,
      )
      router.refresh()
    }
  }, [businessId, router])

  React.useEffect(() => {
    // Se lee después de montar para que el servidor y el navegador dibujen lo mismo la primera vez.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    setOnline(navigator.onLine)
    const goOnline = () => {
      setOnline(true)
      void sync()
    }
    const goOffline = () => setOnline(false)
    const onStorage = (e: StorageEvent) => e.key === KEY && refresh()
    window.addEventListener(CHANGED, refresh)
    window.addEventListener("storage", onStorage)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    void sync()
    // Por si el aviso de "volvió internet" no llega (pasa en algunos teléfonos).
    const timer = setInterval(() => void sync(), 30_000)
    return () => {
      window.removeEventListener(CHANGED, refresh)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
      clearInterval(timer)
    }
  }, [refresh, sync])

  const waiting = pending.filter((s) => !s.error)
  const failed = pending.filter((s) => s.error)
  if (online && !pending.length) return null

  const sum = waiting.reduce((t, s) => t + s.total, 0)
  return (
    <div className="mb-5 space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm" role="status">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <CloudOff className="size-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-medium">
            {online ? "Volvió la conexión" : "Sin internet"}
            {waiting.length ? ` · ${waiting.length} venta${waiting.length === 1 ? "" : "s"} por subir (${formatMoney(sum, currency)})` : ""}
          </p>
          <p className="text-muted-foreground">
            {online
              ? "Las ventas guardadas en este equipo se están subiendo solas."
              : "Puedes seguir registrando ventas: quedan guardadas en este equipo y se suben solas cuando vuelva la señal. No cierres la sesión."}
          </p>
        </div>
        {online && waiting.length ? (
          <Button size="sm" variant="outline" className="bg-background" disabled={syncing} onClick={() => void sync()}>
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Subir ahora
          </Button>
        ) : null}
      </div>
      {failed.length ? (
        <ul className="space-y-2 border-t border-warning/30 pt-3">
          {failed.map((s) => (
            <li key={s.clientId} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <strong>{formatMoney(s.total, currency)}</strong>{" "}
                <span className="text-muted-foreground">
                  · {new Date(s.savedAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} ·
                  no se pudo subir: {s.error}
                </span>
              </span>
              <span className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-background"
                  disabled={syncing}
                  onClick={() => {
                    writeAll(readAll().map((x) => (x.clientId === s.clientId ? { ...x, error: undefined } : x)))
                    void sync()
                  }}
                >
                  <RefreshCw />
                  Reintentar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm("¿Descartar esta venta? Si es real, vuelve a registrarla a mano."))
                      writeAll(readAll().filter((x) => x.clientId !== s.clientId))
                  }}
                >
                  <Trash2 />
                  Descartar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
