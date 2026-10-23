"use client"

import * as React from "react"
import { CheckCircle2, Loader2, ScanBarcode, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"
import { cn } from "@/lib/utils"

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type DetectorClass = { new (o: { formats: string[] }): Detector; getSupportedFormats: () => Promise<string[]> }

/**
 * Lector nativo del navegador (Chrome en Android) o, si no existe (iPhone), la versión en WebAssembly.
 * Lee todos los tipos de código que el lector conoce: los de supermercado (EAN, UPC), Code 128/39/93, Codabar,
 * ITF, DataBar (frutas y verduras), Data Matrix (remedios y cosméticos), PDF417, Aztec, QR y más.
 */
async function createDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector
  if (native) {
    const formats = await native.getSupportedFormats().catch(() => [] as string[])
    return formats.length ? new native({ formats }) : new native({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"] })
  }
  const { BarcodeDetector, setZXingModuleOverrides, ZXING_WASM_VERSION } = await import("barcode-detector/ponyfill")
  // El motor se sirve desde el propio sitio (lo copia scripts/copy-wasm.mjs), no desde un servidor externo.
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/wasm/zxing_reader-${ZXING_WASM_VERSION}.wasm` : prefix + path),
  })
  // "any" = todos los formatos que soporta la versión en WebAssembly.
  return new BarcodeDetector({ formats: ["any"] }) as unknown as Detector
}

/** Lo que muestra el lector después de leer un código (ej. "Coca-Cola 1.5L agregado"). */
export type ScanFeedback = { ok: boolean; message: string }

// Sonido de "bip". Se prepara al tocar el botón porque el celular no deja sonar sin que la persona toque algo.
let audio: AudioContext | null = null
function unlockAudio() {
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch {
    audio = null
  }
}
function beep(ok: boolean) {
  if (!audio) return
  try {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = ok ? 1650 : 330
    gain.gain.setValueAtTime(0.18, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + (ok ? 0.12 : 0.3))
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + (ok ? 0.12 : 0.3))
  } catch {
    // sin sonido no pasa nada
  }
}

/**
 * Botón "Escanear" que abre la cámara y lee un código de barras.
 * Un lector USB o Bluetooth también sirve: escribe el código en el recuadro como si fuera un teclado.
 * Con `continuous` la cámara queda abierta y se pueden pasar varios productos seguidos, como en una caja.
 */
export function ScanButton({
  onResult,
  label = "Escanear",
  size = "default",
  continuous = false,
}: {
  onResult: (code: string) => ScanFeedback | void
  label?: string
  size?: "default" | "sm" | "icon"
  continuous?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={() => {
          unlockAudio()
          setOpen(true)
        }}
        aria-label={label}
      >
        <ScanBarcode />
        {size === "icon" ? null : label}
      </Button>
      <AppModal
        open={open}
        onOpenChange={setOpen}
        title="Escanear código de barras"
        description={continuous ? "Pasa los productos uno por uno frente a la cámara. Toca “Listo” al terminar." : "Apunta la cámara al código del producto."}
      >
        {open ? (
          continuous ? (
            <Scanner continuous onResult={onResult} onClose={() => setOpen(false)} />
          ) : (
            <Scanner
              onResult={(code) => {
                setOpen(false)
                const fb = onResult(code)
                if (fb) {
                  if (fb.ok) toast.success(fb.message)
                  else toast.error(fb.message)
                }
                return fb
              }}
            />
          )
        ) : null}
      </AppModal>
    </>
  )
}

/** Un mismo código leído de nuevo antes de este tiempo es el mismo producto frente a la cámara, no otro. */
const SAME_CODE_MS = 1500

function Scanner({
  onResult,
  continuous = false,
  onClose,
}: {
  onResult: (code: string) => ScanFeedback | void
  continuous?: boolean
  onClose?: () => void
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [status, setStatus] = React.useState<"starting" | "scanning" | "error">("starting")
  const [error, setError] = React.useState("")
  const [manual, setManual] = React.useState("")
  const [feedback, setFeedback] = React.useState<(ScanFeedback & { key: number }) | null>(null)
  const [count, setCount] = React.useState(0)
  const done = React.useRef(false)
  const last = React.useRef({ code: "", at: 0 })
  // La cámara se abre una sola vez aunque cambie la función que recibe el código.
  const resultRef = React.useRef(onResult)
  React.useEffect(() => {
    resultRef.current = onResult
  })

  /** Entrega un código leído; en modo continuo muestra el resultado y sigue escaneando. */
  const handle = React.useCallback(
    (code: string, fromCamera: boolean) => {
      if (!continuous) {
        done.current = true
        navigator.vibrate?.(80)
        resultRef.current(code)
        return
      }
      const now = Date.now()
      if (fromCamera && last.current.code === code && now - last.current.at < SAME_CODE_MS) {
        last.current.at = now
        return
      }
      last.current = { code, at: now }
      const fb = resultRef.current(code) ?? { ok: true, message: `Código ${code}` }
      beep(fb.ok)
      navigator.vibrate?.(fb.ok ? 80 : [60, 60, 60])
      setFeedback({ ...fb, key: now })
      if (fb.ok) setCount((c) => c + 1)
    },
    [continuous],
  )
  const handleRef = React.useRef(handle)
  React.useEffect(() => {
    handleRef.current = handle
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
              handleRef.current(code, true)
              if (done.current) return
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
          // El modal vive dentro de otro formulario (venta, producto): sin esto, "Usar" también lo enviaría.
          e.stopPropagation()
          if (!manual.trim()) return
          handle(manual.trim(), false)
          setManual("")
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
          {continuous ? "Agregar" : "Usar"}
        </Button>
      </form>
      {continuous ? (
        <>
          <div aria-live="polite" className="min-h-12">
            {feedback ? (
              <p
                key={feedback.key}
                className={cn(
                  "flex items-center gap-2 rounded-lg p-3 text-sm font-medium animate-in fade-in-0 zoom-in-95",
                  feedback.ok ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger",
                )}
              >
                {feedback.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
                {feedback.message}
              </p>
            ) : (
              <p className="p-3 text-center text-sm text-muted-foreground">Escanea el primer producto.</p>
            )}
          </div>
          <Button type="button" size="lg" className="h-11 text-base" onClick={onClose}>
            Listo{count ? ` · ${count} ${count === 1 ? "producto escaneado" : "productos escaneados"}` : ""}
          </Button>
        </>
      ) : null}
    </div>
  )
}
