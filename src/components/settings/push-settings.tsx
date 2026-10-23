"use client"

import * as React from "react"
import { BellRing, Loader2, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { subscribePush, testPush, unsubscribePush } from "@/server/actions/push"

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on"

/** La clave pública llega en texto (base64 url) y el navegador la pide en bytes. */
function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function deviceName() {
  const ua = navigator.userAgent
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Navegador"
  const app = window.matchMedia("(display-mode: standalone)").matches ? "app" : "navegador"
  return `${os} (${app})`
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" })
}

/** Avisos en el celular: pedidos web nuevos y solicitudes del equipo, aunque la app esté cerrada. */
export function PushSettings({ publicKey }: { publicKey: string }) {
  const [state, setState] = React.useState<State>("loading")
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    async function check() {
      const ios = /iPhone|iPad/.test(navigator.userAgent)
      const standalone = window.matchMedia("(display-mode: standalone)").matches
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return ios && !standalone ? "ios-install" : "unsupported"
      }
      if (Notification.permission === "denied") return "denied"
      const reg = await navigator.serviceWorker.getRegistration("/")
      const sub = await reg?.pushManager.getSubscription()
      return sub ? "on" : "off"
    }
    check()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState("unsupported"))
    return () => {
      alive = false
    }
  }, [])

  async function turnOn() {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off")
        return void toast.info("Sin tu permiso no podemos mandarte avisos.")
      }
      const reg = await registration()
      await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const r = await subscribePush({ endpoint: json.endpoint, keys: json.keys, device: deviceName() })
      if (!r.ok) {
        await sub.unsubscribe().catch(() => {})
        return void toast.error(r.message)
      }
      setState("on")
      toast.success(r.message)
    } catch {
      toast.error("No se pudieron activar los avisos en este navegador.")
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration("/")
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await unsubscribePush(sub.endpoint)
        await sub.unsubscribe()
      }
      setState("off")
      toast.success("Avisos desactivados en este aparato")
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    const r = await testPush()
    setBusy(false)
    if (r.ok) toast.success(r.message)
    else toast.error(r.message)
  }

  const hint =
    state === "ios-install"
      ? "En iPhone primero agrega OrdenSimple a tu pantalla de inicio (toca Compartir y luego “Agregar a inicio”) y ábrelo desde ahí."
      : state === "unsupported"
        ? "Este navegador no permite avisos. Prueba con Chrome, Edge o Safari actualizados."
        : state === "denied"
          ? "Bloqueaste los avisos para OrdenSimple. Actívalos en los permisos del navegador (el candado junto a la dirección) y vuelve aquí."
          : "Pedidos web, solicitudes de tu equipo y platos listos en la cocina, aunque tengas la app cerrada. También stock bajo, vencimientos, fiado y pagos a proveedores, según lo que actives abajo. Se activa en cada aparato."

  return (
    <div className="space-y-3 py-3">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="push-switch" className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="size-4.5" />
          </span>
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Avisos en este celular o computador</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </span>
        </label>
        {state === "loading" || busy ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            id="push-switch"
            checked={state === "on"}
            disabled={state !== "on" && state !== "off"}
            onCheckedChange={(v) => void (v ? turnOn() : turnOff())}
            aria-label="Avisos en este aparato"
          />
        )}
      </div>
      {state === "on" ? (
        <Button variant="outline" size="sm" onClick={() => void test()} disabled={busy} className="ml-12">
          <BellRing />
          Mandarme un aviso de prueba
        </Button>
      ) : null}
    </div>
  )
}
