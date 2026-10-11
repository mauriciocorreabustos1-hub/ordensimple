"use client"

import * as React from "react"
import { Download, EllipsisVertical, Share, Smartphone, SquarePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppModal } from "@/components/app/app-modal"
import { cn } from "@/lib/utils"

/**
 * "Instalar" OrdenSimple en el celular: no está en App Store ni Google Play, pero se puede agregar a la pantalla
 * de inicio y se abre como una app. En Android (Chrome) se instala con un toque; en iPhone se muestran los pasos.
 */

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

// Chrome avisa una sola vez que la página se puede instalar: se guarda para usarlo cuando la persona toque el botón.
let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferred = e as InstallPrompt
    listeners.forEach((l) => l())
  })
  window.addEventListener("appinstalled", () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

export type Platform = "iphone" | "android" | "otro"

type Info = { platform: Platform; installed: boolean; inAppBrowser: boolean; canPrompt: boolean }

export function useInstallInfo(): Info | null {
  const [info, setInfo] = React.useState<Info | null>(null)
  React.useEffect(() => {
    const read = () => {
      const ua = navigator.userAgent
      const iphone = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      setInfo({
        platform: iphone ? "iphone" : /Android/i.test(ua) ? "android" : "otro",
        installed: window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as { standalone?: boolean }).standalone),
        // Instagram, Facebook y TikTok abren las páginas en su propio navegador, que no permite instalar.
        inAppBrowser: /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Bytedance/i.test(ua),
        canPrompt: Boolean(deferred),
      })
    }
    read()
    listeners.add(read)
    return () => {
      listeners.delete(read)
    }
  }, [])
  return info
}

async function promptInstall() {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  listeners.forEach((l) => l())
  return outcome === "accepted"
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {n}
      </span>
      <span className="pt-0.5 text-pretty">{children}</span>
    </li>
  )
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded-md border bg-muted px-1.5 py-0.5 align-middle text-sm font-medium whitespace-nowrap">
    {children}
  </span>
)

export function IphoneSteps() {
  return (
    <ol className="space-y-3">
      <Step n={1}>
        Abre <strong>ordensimple.cl</strong> en <strong>Safari</strong>.
      </Step>
      <Step n={2}>
        Toca{" "}
        <Key>
          <Share className="size-4" /> Compartir
        </Key>
        .
      </Step>
      <Step n={3}>
        Toca{" "}
        <Key>
          <SquarePlus className="size-4" /> Agregar a inicio
        </Key>
        .
      </Step>
      <Step n={4}>
        Toca <strong>Agregar</strong>.
      </Step>
    </ol>
  )
}

export function AndroidSteps() {
  return (
    <ol className="space-y-3">
      <Step n={1}>
        Abre <strong>ordensimple.cl</strong> en <strong>Chrome</strong>.
      </Step>
      <Step n={2}>
        Toca el menú{" "}
        <Key>
          <EllipsisVertical className="size-4" />
        </Key>
        .
      </Step>
      <Step n={3}>
        Toca <Key>Instalar app</Key>.
      </Step>
      <Step n={4}>
        Toca <strong>Instalar</strong>.
      </Step>
    </ol>
  )
}

/** Aviso para quien abrió la página dentro de Instagram, Facebook o TikTok. */
export function InAppBrowserNote({ platform }: { platform: Platform }) {
  return (
    <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-pretty">
      Desde Instagram, Facebook o TikTok no se puede instalar. Toca <strong>⋯</strong> y elige{" "}
      <strong>{platform === "iphone" ? "Abrir en Safari" : "Abrir en Chrome"}</strong>.
    </p>
  )
}

/** Botón que instala con un toque cuando el navegador lo permite (Chrome en Android y en computador). */
export function InstallButton({ className, label = "Instalar OrdenSimple" }: { className?: string; label?: string }) {
  const info = useInstallInfo()
  if (!info?.canPrompt || info.installed) return null
  return (
    <Button size="lg" className={cn("h-11", className)} onClick={() => void promptInstall()}>
      <Download />
      {label}
    </Button>
  )
}

const HIDE_KEY = "instalar-app-oculto"

/** Aviso en el Inicio de la app (solo en el celular y si aún no está instalada). Se puede cerrar. */
export function InstallCard() {
  const info = useInstallInfo()
  const [hidden, setHidden] = React.useState(true)
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    try {
      // Se lee después de montar para que el servidor y el navegador dibujen lo mismo la primera vez.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(localStorage.getItem(HIDE_KEY) === "1")
    } catch {
      setHidden(false)
    }
  }, [])
  if (!info || hidden || info.installed || info.platform === "otro") return null

  const close = () => {
    setHidden(true)
    try {
      localStorage.setItem(HIDE_KEY, "1")
    } catch {}
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm">
        <Smartphone className="size-5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-pretty">
          <span className="font-medium">Tenla como app.</span>{" "}
          <span className="text-muted-foreground">Agrega OrdenSimple a tu pantalla de inicio y ábrela con un toque.</span>
        </p>
        <Button
          size="sm"
          onClick={async () => {
            if (info.canPrompt && (await promptInstall())) return close()
            setOpen(true)
          }}
        >
          {info.canPrompt ? "Instalar" : "Ver cómo"}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={close} aria-label="No mostrar más" title="No mostrar más">
          <X />
        </Button>
      </div>
      <AppModal
        open={open}
        onOpenChange={setOpen}
        title="Agrega OrdenSimple a tu pantalla de inicio"
        description="No está en App Store ni Google Play. Así queda como una app."
      >
        <div className="space-y-4">
          {info.inAppBrowser ? <InAppBrowserNote platform={info.platform} /> : null}
          {info.platform === "iphone" ? <IphoneSteps /> : <AndroidSteps />}
          <Button className="h-11 w-full" variant="outline" onClick={() => setOpen(false)}>
            Entendido
          </Button>
        </div>
      </AppModal>
    </>
  )
}
