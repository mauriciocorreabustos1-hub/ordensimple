"use client"

import * as React from "react"
import Link from "next/link"
import QRCode from "qrcode"
import { AlertTriangle, BarChart3, Check, Copy, Download, ExternalLink, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { SocialIcon } from "@/components/links/social-icons"
import { ColorField, Field } from "@/components/links/editor/fields"
import { contrast, slugProblem } from "@/lib/links"
import { whatsappLink } from "@/lib/whatsapp"
import { changeLinkSlug, checkLinkSlug } from "@/server/actions/links"
import { cn } from "@/lib/utils"

export function CopyButton({ text, label = "Copiar enlace", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1800)
        } catch {
          toast.error("No pudimos copiar. Mantén presionado el enlace para copiarlo.")
        }
      }}
    >
      {done ? <Check /> : <Copy />}
      {done ? "Copiado" : label}
    </Button>
  )
}

export function SharePanel({
  slug,
  publicUrl,
  qrUrl,
  host,
  published,
  logoSrc,
  name,
  onSlugChanged,
}: {
  slug: string
  publicUrl: string
  qrUrl: string
  /** Cómo se escribe la dirección antes del nombre (ej.: links.ordensimple.cl/). */
  host: string
  published: boolean
  logoSrc: string | null
  name: string
  onSlugChanged: (slug: string) => void
}) {
  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Tu dirección</h3>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-2 pl-3.5">
          <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{publicUrl.replace(/^https?:\/\//, "")}</span>
          <CopyButton text={publicUrl} />
        </div>
        {!published ? <p className="text-xs text-muted-foreground">Todavía no está publicada: quien abra el enlace verá “Página no encontrada” hasta que la publiques.</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <a href={whatsappLink(null, `Mira mi página: ${publicUrl}`)} target="_blank" rel="noopener noreferrer">
              <SocialIcon kind="whatsapp" className="size-4" /> Enviar por WhatsApp
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              if (navigator.share) await navigator.share({ title: name, url: publicUrl }).catch(() => {})
              else {
                await navigator.clipboard.writeText(publicUrl).catch(() => {})
                toast.success("Enlace copiado")
              }
            }}
          >
            <Share2 /> Compartir
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href="/dashboard/links/estadisticas">
              <BarChart3 /> Ver estadísticas
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Pega tu dirección en la biografía de Instagram y TikTok, en tu estado de WhatsApp y en tus correos.</p>
      </section>

      <SlugForm slug={slug} host={host} onChanged={onSlugChanged} />

      <QrSection url={qrUrl} logoSrc={logoSrc} slug={slug} />
    </div>
  )
}

function SlugForm({ slug, host, onChanged }: { slug: string; host: string; onChanged: (s: string) => void }) {
  const [value, setValue] = React.useState(slug)
  const [remote, setRemote] = React.useState<{ slug: string; ok: boolean; message: string } | null>(null)
  const [pending, start] = React.useTransition()
  const clean = value.trim().toLowerCase()
  const changed = clean !== slug
  const local = changed ? slugProblem(clean) : null
  const status = !changed ? null : local ? { ok: false, message: local } : remote?.slug === clean ? remote : null

  React.useEffect(() => {
    if (!changed || local) return
    const t = setTimeout(async () => {
      const r = await checkLinkSlug(clean).catch(() => null)
      if (r) setRemote({ slug: clean, ok: r.ok, message: r.message ?? "" })
    }, 450)
    return () => clearTimeout(t)
  }, [clean, changed, local])

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Nombre de usuario</h3>
        <p className="text-xs text-muted-foreground">Si lo cambias, la dirección anterior y tu QR siguen llevando a tu página.</p>
      </div>
      <form
        className="flex flex-wrap items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            const r = await changeLinkSlug(clean)
            if (r.ok && r.data) {
              toast.success(r.message)
              onChanged(r.data.slug)
            } else if (!r.ok) toast.error(r.message)
          })
        }}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex h-9 items-center rounded-lg border bg-background pl-3 focus-within:ring-3 focus-within:ring-ring/50">
            <span className="shrink-0 text-sm text-muted-foreground">{host}</span>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase().replace(/\s+/g, ""))}
              maxLength={30}
              aria-label="Nombre de usuario"
              spellCheck={false}
              autoCapitalize="none"
              className="h-8 border-0 bg-transparent pl-0.5 shadow-none focus-visible:ring-0"
            />
          </div>
          {status ? <p className={cn("text-xs", status.ok ? "text-success" : "text-danger")}>{status.message}</p> : null}
        </div>
        <Button type="submit" disabled={!changed || pending || status?.ok === false}>
          {pending ? <Loader2 className="animate-spin" /> : null} Cambiar
        </Button>
      </form>
    </section>
  )
}

/** El QR con colores y logo, armado en el navegador. Lleva a la dirección estable (con ?src=qr para las estadísticas). */
function QrSection({ url, logoSrc, slug }: { url: string; logoSrc: string | null; slug: string }) {
  const [dark, setDark] = React.useState("#0b2015")
  const [light, setLight] = React.useState("#ffffff")
  const [withLogo, setWithLogo] = React.useState(Boolean(logoSrc))
  const [svg, setSvg] = React.useState<string | null>(null)
  const readable = contrast(dark, light) >= 4 && luminanceOf(dark) < luminanceOf(light)

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      const base = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: withLogo && logoSrc ? "H" : "M", color: { dark, light } })
      let out = base
      if (withLogo && logoSrc) {
        const logo = await toDataUrl(logoSrc).catch(() => null)
        const size = Number(/viewBox="0 0 (\d+)/.exec(base)?.[1] ?? 0)
        if (logo && size) {
          // El logo ocupa un 22 % al centro, sobre un recuadro del color claro: con corrección alta el QR se sigue leyendo.
          const s = size * 0.22
          const pad = s * 0.12
          const at = (size - s) / 2
          out = base.replace(
            "</svg>",
            `<rect x="${at - pad}" y="${at - pad}" width="${s + pad * 2}" height="${s + pad * 2}" rx="${pad * 1.5}" fill="${light}"/><image href="${logo}" x="${at}" y="${at}" width="${s}" height="${s}" preserveAspectRatio="xMidYMid meet"/></svg>`,
          )
        }
      }
      if (alive) setSvg(out)
    })().catch(() => alive && setSvg(null))
    return () => {
      alive = false
    }
  }, [url, dark, light, withLogo, logoSrc])

  const download = async (format: "svg" | "png") => {
    if (!svg) return
    const name = `qr-${slug}.${format}`
    if (format === "svg") return save(new Blob([svg], { type: "image/svg+xml" }), name)
    const img = new Image()
    const src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 1200
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, 1200, 1200)
      URL.revokeObjectURL(src)
      canvas.toBlob((blob) => blob && save(blob, name), "image/png")
    }
    img.onerror = () => toast.error("No pudimos crear la imagen. Prueba con SVG.")
    img.src = src
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Código QR</h3>
        <p className="text-xs text-muted-foreground">Para el mostrador, la vitrina, tus bolsas o tarjetas. Sigue funcionando aunque cambies tus bloques o tu nombre de usuario.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <div className="grid aspect-square w-44 place-items-center overflow-hidden rounded-xl border bg-white p-2 sm:w-full">
          {svg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="Código QR de tu página" className="size-full" />
          ) : (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Puntos" value={dark} onChange={setDark} />
            <ColorField label="Fondo" value={light} onChange={setLight} />
          </div>
          {logoSrc ? (
            <label className="flex items-center gap-2 text-[13px]">
              <Switch size="sm" checked={withLogo} onCheckedChange={setWithLogo} aria-label="Poner el logo al centro" />
              Poner tu logo al centro
            </label>
          ) : null}
          {!readable ? (
            <p className="flex items-start gap-1.5 text-xs text-danger">
              <AlertTriangle className="mt-px size-3.5 shrink-0" /> Con estos colores el QR puede no leerse: los puntos tienen que ser bastante más oscuros que el fondo.
            </p>
          ) : null}
          <Field label="Descargar">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => download("png")} disabled={!svg || !readable}>
                <Download /> PNG
              </Button>
              <Button type="button" variant="outline" onClick={() => download("svg")} disabled={!svg || !readable}>
                <Download /> SVG (para imprenta)
              </Button>
              <Button type="button" variant="ghost" asChild>
                <a href={url} target="_blank" rel="noopener">
                  <ExternalLink /> Probar
                </a>
              </Button>
            </div>
          </Field>
        </div>
      </div>
    </section>
  )
}

function luminanceOf(color: string) {
  return contrast(color, "#000000")
}

async function toDataUrl(src: string) {
  const blob = await fetch(src).then((r) => (r.ok ? r.blob() : Promise.reject()))
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function save(blob: Blob, name: string) {
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
