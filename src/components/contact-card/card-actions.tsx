"use client"

import * as React from "react"
import { Check, Maximize2, Share2, Smartphone, UserPlus, X } from "lucide-react"
import { AppModal } from "@/components/app/app-modal"
import { InstallGuide } from "@/components/contact-card/install-guide"
import { Button } from "@/components/ui/button"

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> }

function subscribeStandalone(onChange: () => void) {
  const media = window.matchMedia("(display-mode: standalone)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** Pantalla completa para mostrar el QR. En iPhone Safari no existe la pantalla completa del navegador: cubre toda la página. */
function Presentation({ name, qr, onClose }: { name: string; qr: string; onClose: () => void }) {
  const close = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    close.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    document.documentElement.requestFullscreen?.().catch(() => {})
    // Que la pantalla no se apague mientras alguien escanea.
    let lock: { release: () => Promise<void> } | null = null
    let closed = false
    ;(navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
      ?.request("screen")
      .then((l) => {
        if (closed) void l.release()
        else lock = l
      })
      .catch(() => {})
    return () => {
      closed = true
      document.body.style.overflow = overflow
      document.removeEventListener("keydown", onKey)
      void lock?.release().catch(() => {})
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label={`Código QR de ${name}`} className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-white p-6 text-center text-[#13201c]">
      <button
        ref={close}
        type="button"
        onClick={onClose}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 inline-flex h-11 items-center gap-1.5 rounded-lg border border-black/15 px-3 text-sm font-medium"
      >
        <X className="size-4" />
        Cerrar
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="" className="aspect-square w-[min(82vw,62dvh)]" />
      <div>
        <p className="font-display text-3xl font-semibold tracking-tight text-balance">{name}</p>
        <p className="mt-1 text-[#4b5a55]">Escanea para ver mi tarjeta</p>
      </div>
    </div>
  )
}

/** Los botones de la tarjeta pública. Cada uno hace algo real; lo que el equipo no puede hacer, se ofrece de otra forma. */
export function CardActions({ path, url, name, qr }: { path: string; url: string; name: string; qr: string }) {
  const [presenting, setPresenting] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [shareError, setShareError] = React.useState(false)
  const [guide, setGuide] = React.useState<"iphone" | "android" | null>(null)
  const [installEvent, setInstallEvent] = React.useState<InstallEvent | null>(null)
  const standalone = React.useSyncExternalStore(subscribeStandalone, isStandalone, () => false)
  const closePresentation = React.useCallback(() => setPresenting(false), [])

  React.useEffect(() => {
    // Guarda la tarjeta para abrirla aunque no haya señal.
    navigator.serviceWorker?.register(`${path}/sw.js`, { scope: path }).catch(() => {})
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as InstallEvent)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    return () => window.removeEventListener("beforeinstallprompt", onPrompt)
  }, [path])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setShareError(false)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setShareError(true)
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, text: `Tarjeta de ${name}`, url })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
      }
    }
    await copyLink()
  }

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice.catch(() => {})
    setInstallEvent(null)
    setGuide(null)
  }

  return (
    <div className="space-y-2.5">
      <Button size="lg" className="h-12 w-full text-base" asChild>
        <a href={`${path}/contacto.vcf`}>
          <UserPlus />
          Guardar contacto
        </a>
      </Button>
      <div className="grid grid-cols-2 gap-2.5">
        <Button type="button" variant="outline" size="lg" className="h-11" onClick={share}>
          {copied ? <Check /> : <Share2 />}
          {copied ? "Enlace copiado" : "Compartir tarjeta"}
        </Button>
        <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => setPresenting(true)}>
          <Maximize2 />
          Presentar
        </Button>
      </div>
      {shareError ? <p role="alert" className="text-sm break-all text-muted-foreground">No se pudo copiar. Tu enlace es {url}</p> : null}
      {standalone ? null : (
        <Button type="button" variant="ghost" size="sm" className="h-11 w-full text-muted-foreground" onClick={() => setGuide(/android/i.test(navigator.userAgent) ? "android" : "iphone")}>
          <Smartphone />
          Instalar como app
        </Button>
      )}

      <AppModal open={guide !== null} onOpenChange={(o) => !o && setGuide(null)} title="Instala tu tarjeta como app">
        <InstallGuide defaultTab={guide ?? "iphone"} onInstall={installEvent ? install : undefined} />
      </AppModal>
      {presenting ? <Presentation name={name} qr={qr} onClose={closePresentation} /> : null}
    </div>
  )
}
