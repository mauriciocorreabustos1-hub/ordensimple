"use client"

import * as React from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { imageSrc } from "@/components/links/link-page-view"
import { IMAGE_ACCEPT, isImageFile, shrinkImage } from "@/lib/image-shrink"
import { uploadLinkImage } from "@/server/actions/links"
import { cn } from "@/lib/utils"

// Campos del editor de Links: siempre con su etiqueta visible, contador cuando hay un máximo y el problema escrito.

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string
  hint?: React.ReactNode
  error?: string | null
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[13px] font-medium">{label}</Label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  max,
  placeholder,
  hint,
  error,
  type = "text",
  inputMode,
  multiline,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  max: number
  placeholder?: string
  hint?: React.ReactNode
  error?: string | null
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  multiline?: boolean
  className?: string
}) {
  const id = React.useId()
  const counter = value.length > max * 0.7 ? `${value.length}/${max}` : null
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </Label>
        {counter ? <span className={cn("text-[11px] tabular-nums", value.length >= max ? "text-danger" : "text-muted-foreground")}>{counter}</span> : null}
      </div>
      {multiline ? (
        <Textarea id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={3} className="resize-y" aria-invalid={Boolean(error)} />
      ) : (
        <Input id={id} type={type} inputMode={inputMode} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} />
      )}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Botones de opción (una sola elegida), como las pestañas de una carpeta. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode; title?: string }[]
  label: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition-colors",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = React.useState(value)
  // Si el color cambia desde afuera (una plantilla, "Arreglar"), el texto se pone al día.
  const [prev, setPrev] = React.useState(value)
  if (prev !== value) {
    setPrev(value)
    setText(value)
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium">{label}</Label>
      <div className="flex h-9 items-center gap-2 rounded-lg border bg-background pr-2 pl-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label}: elegir color`}
          className="size-7 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-black/10 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <input
          value={text}
          onChange={(e) => {
            const v = e.target.value.trim()
            setText(v)
            const full = /^#?[0-9a-f]{6}$/i.test(v) ? (v.startsWith("#") ? v : `#${v}`) : null
            if (full) onChange(full.toLowerCase())
          }}
          onBlur={() => setText(value)}
          aria-label={`${label}: código del color`}
          spellCheck={false}
          className="w-full min-w-0 bg-transparent font-mono text-xs uppercase outline-none"
        />
      </div>
    </div>
  )
}

export function ProTag({ className }: { className?: string }) {
  return <span className={cn("rounded border border-primary/30 px-1 text-[10px] leading-4 font-semibold text-primary", className)}>Pro</span>
}

/** Sube una foto (se achica en el teléfono antes de subirla) y entrega su id. */
export function ImageField({
  label,
  value,
  onChange,
  hint,
  max = 1080,
  square = false,
  className,
}: {
  label: string
  value: string | null
  onChange: (id: string | null) => void
  hint?: string
  max?: number
  square?: boolean
  className?: string
}) {
  const input = React.useRef<HTMLInputElement>(null)
  const [pending, startTransition] = React.useTransition()

  function pick(file: File | undefined) {
    if (!file) return
    if (!isImageFile(file)) return void toast.error("Elige una imagen (PNG, JPG, WebP o HEIC).")
    startTransition(async () => {
      try {
        const data = await shrinkImage(file, max, square, square ? "webp" : "jpeg", 290 * 1024)
        const r = await uploadLinkImage(data)
        if (r.ok && r.data) onChange(r.data.id)
        else if (!r.ok) toast.error(r.message)
      } catch {
        toast.error("No pudimos leer esa imagen. Prueba con otra.")
      }
      if (input.current) input.current.value = ""
    })
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[13px] font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden border border-dashed bg-muted/50 text-muted-foreground transition-colors hover:bg-muted",
            square ? "size-16 rounded-full" : "h-16 w-28 rounded-lg",
          )}
          aria-label={value ? `Cambiar ${label.toLowerCase()}` : `Subir ${label.toLowerCase()}`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc(value)} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-5" />
          )}
          {pending ? (
            <span className="absolute inset-0 grid place-items-center bg-background/70">
              <Loader2 className="size-5 animate-spin" />
            </span>
          ) : null}
        </button>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={pending}>
            {value ? "Cambiar" : "Subir foto"}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={pending}>
              <Trash2 />
              Quitar
            </Button>
          ) : null}
        </div>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <input ref={input} type="file" accept={IMAGE_ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}
