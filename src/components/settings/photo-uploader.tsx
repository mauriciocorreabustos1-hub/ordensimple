"use client"

import * as React from "react"
import { Camera, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { initials } from "@/components/app/user-menu"
import { shrinkImage } from "@/lib/image-shrink"
import { removeUserPhoto, uploadUserPhoto } from "@/server/actions/photo"

/** Foto de perfil: se recorta cuadrada al centro y se achica en el navegador antes de subirla. */
export function PhotoUploader({ name, image }: { name: string; image: string | null }) {
  const input = React.useRef<HTMLInputElement>(null)
  const [pending, startTransition] = React.useTransition()

  function pick(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) return void toast.error("Elige una imagen (PNG, JPG o WebP).")
    startTransition(async () => {
      try {
        const r = await uploadUserPhoto(await shrinkImage(file, 256, true))
        if (r.ok) toast.success(r.message ?? "Foto guardada")
        else toast.error(r.message)
      } catch {
        toast.error("No pudimos leer esa imagen. Prueba con otra.")
      }
      if (input.current) input.current.value = ""
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar className="size-16">
        {image ? <AvatarImage src={image} alt={`Foto de ${name}`} /> : null}
        <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
            {pending ? <Loader2 className="animate-spin" /> : <Camera />}
            {image ? "Cambiar foto" : "Subir foto"}
          </Button>
          {image ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await removeUserPhoto()
                  if (r.ok) toast.success(r.message ?? "Foto quitada")
                  else toast.error(r.message)
                })
              }
            >
              <Trash2 />
              Quitar
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">Tu foto se ve en tu perfil y la ve tu equipo. Se recorta cuadrada.</p>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label="Elegir foto de perfil" />
    </div>
  )
}
