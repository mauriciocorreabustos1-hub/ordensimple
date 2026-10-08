"use client"

import * as React from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BusinessLogo } from "@/components/app/business-logo"
import { removeBusinessLogo, uploadBusinessLogo } from "@/server/actions/logo"

const MAX = 256

/** Achica la imagen en el navegador (máximo 256 px, sin perder la transparencia) y la entrega lista para guardar. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error("imagen"))
      i.src = url
    })
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h)
    const webp = canvas.toDataURL("image/webp", 0.9)
    // Navegadores que no generan WebP devuelven PNG.
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png")
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function LogoUploader({
  businessId,
  name,
  logoUpdatedAt,
  disabled,
}: {
  businessId: string
  name: string
  logoUpdatedAt: string | null
  disabled?: boolean
}) {
  const input = React.useRef<HTMLInputElement>(null)
  const [pending, startTransition] = React.useTransition()

  function pick(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) return void toast.error("Elige una imagen (PNG, JPG o WebP).")
    startTransition(async () => {
      try {
        const r = await uploadBusinessLogo(await shrink(file))
        if (r.ok) toast.success(r.message ?? "Logo guardado")
        else toast.error(r.message)
      } catch {
        toast.error("No pudimos leer esa imagen. Prueba con otra.")
      }
      if (input.current) input.current.value = ""
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <BusinessLogo businessId={businessId} name={name} logoUpdatedAt={logoUpdatedAt} className="size-16 rounded-2xl border text-lg" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled || pending} onClick={() => input.current?.click()}>
            {pending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {logoUpdatedAt ? "Cambiar logo" : "Subir logo"}
          </Button>
          {logoUpdatedAt ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={disabled || pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await removeBusinessLogo()
                  if (r.ok) toast.success(r.message ?? "Logo quitado")
                  else toast.error(r.message)
                })
              }
            >
              <Trash2 />
              Quitar
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG o WebP. Mejor si es cuadrado y con fondo blanco o transparente.</p>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label="Elegir logo" />
    </div>
  )
}
