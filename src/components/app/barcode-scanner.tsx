"use client"

import * as React from "react"
import { Loader2, ScanBarcode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"]

/** Lector nativo del navegador (Chrome en Android) o, si no existe (iPhone), la versión en WebAssembly. */
async function createDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
  if (native) return new native({ formats: FORMATS })
  const { BarcodeDetector } = await import("barcode-detector/ponyfill")
  return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector
}

/**
 * Botón "Escanear" que abre la cámara y lee un código de barras.
 * Un lector USB o Bluetooth también sirve: escribe el código en el recuadro como si fuera un teclado.
 */
export function ScanButton({
  onResult,
  label = "Escanear",
  size = "default",
}: {
  onResult: (code: string) => void
  label?: string
  size?: "default" | "sm" | "icon"
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button type="button" variant="outline" size={size} onClick={() => setOpen(true)} aria-label={label}>
        <ScanBarcode />
        {size === "icon" ? null : label}
      </Button>
      <AppModal open={open} onOpenChange={setOpen} title="Escanear código de barras" description="Apunta la cámara al código del producto.">
        {open ? (
          <Scanner
            onResult={(code) => {
              setOpen(false)
              onResult(code)
            }}
          />
        ) : null}
      </AppModal>
    </>
  )
}

function Scanner({ onResult }: { onResult: (code: string) => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [status, setStatus] = React.useState<"starting" | "scanning" | "error">("starting")
  const [error, setError] = React.useState("")
  const [manual, setManual] = React.useState("")
  const done = React.useRef(false)
  // La cámara se abre una sola vez aunque cambie la función que recibe el código.
  const resultRef = React.useRef(onResult)
  React.useEffect(() => {
    resultRef.current = onResult
  })

  React.useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("sin-camara")
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
        if (cancelled) return
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        const detector = await createDetector()
        setStatus("scanning")
        const tick = async () => {
          if (cancelled || done.current) return
          try {
            const found = await detector.detect(video)
            const code = found[0]?.rawValue?.trim()
            if (code && !done.current) {
              done.current = true
              navigator.vibrate?.(80)
              resultRef.current(code)
              return
            }
          } catch {
            // un cuadro sin código: se sigue intentando
          }
          timer = setTimeout(tick, 250)
        }
        void tick()
      } catch (e) {
        if (cancelled) return
        setStatus("error")
        const name = e instanceof Error ? e.name : ""
        setError(
          name === "NotAllowedError"
            ? "No diste permiso para usar la cámara. Actívalo en tu navegador o escribe el código abajo."
            : "No pudimos abrir la cámara en este equipo. Escribe el código abajo o usa un lector de códigos.",
        )
      }
    }
    void start()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="grid gap-4">
      {status !== "error" ? (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          {status === "starting" ? (
            <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white">
              <Loader2 className="size-4 animate-spin" />
              Abriendo la cámara…
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-lg bg-warning/10 p-3 text-sm">{error}</p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim()) onResult(manual.trim())
        }}
      >
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="O escribe el código"
          inputMode="numeric"
          className="h-10"
          autoFocus={status === "error"}
          aria-label="Código de barras"
        />
        <Button type="submit" variant="outline" className="h-10">
          Usar
        </Button>
      </form>
    </div>
  )
}
