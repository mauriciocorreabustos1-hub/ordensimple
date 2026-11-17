"use client"

import * as React from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BusinessLogo } from "@/components/app/business-logo"
import { shrinkImage, IMAGE_ACCEPT, isImageFile } from "@/lib/image-shrink"
import { removeBusinessLogo, uploadBusinessLogo } from "@/server/actions/logo"

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
    if (!isImageFile(file)) return void toast.error("Elige una imagen (PNG, JPG, WebP o HEIC).")
    startTransition(async () => {
      try {
        const r = await uploadBusinessLogo(await shrinkImage(file))
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
      <input ref={input} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label="Elegir logo" />
    </div>
  )
}
