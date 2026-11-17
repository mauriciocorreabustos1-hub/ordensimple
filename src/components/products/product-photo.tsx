"use client"

import * as React from "react"
import { Camera, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { shrinkImage, IMAGE_ACCEPT, isImageFile } from "@/lib/image-shrink"
import { cn } from "@/lib/utils"
import { removeProductPhoto, uploadProductPhoto } from "@/server/actions/product-photo"
import { ProductImage } from "@/components/products/product-image"

/**
 * Foto del producto en la lista de Productos: se toca para sacar o elegir una foto (se achica en el celular antes
 * de subirla). Si ya tiene, aparece un botón para quitarla.
 */
export function ProductPhoto({
  productId,
  name,
  imageUrl,
  enabled,
  className,
}: {
  productId: string
  name: string
  imageUrl: string | null
  /** Si las fotos están activadas (Vercel Blob conectado) y la persona puede editar productos. */
  enabled: boolean
  className?: string
}) {
  const input = React.useRef<HTMLInputElement>(null)
  const [url, setUrl] = React.useState(imageUrl)
  const [pending, startTransition] = React.useTransition()

  function pick(file: File | undefined) {
    if (!file) return
    if (!isImageFile(file)) return void toast.error("Elige una imagen (foto, PNG, JPG o HEIC).")
    startTransition(async () => {
      try {
        const r = await uploadProductPhoto(productId, await shrinkImage(file, 800, false, "webp", 560 * 1024))
        if (r.ok && r.data) {
          setUrl(r.data.url)
          toast.success(`Foto de ${name} guardada`)
        } else toast.error(r.message)
      } catch {
        toast.error("No pudimos leer esa imagen. Prueba con otra.")
      }
      if (input.current) input.current.value = ""
    })
  }

  function remove() {
    startTransition(async () => {
      const r = await removeProductPhoto(productId)
      if (!r.ok) return void toast.error(r.message)
      setUrl(null)
      toast.success("Foto quitada")
    })
  }

  if (!enabled) return <ProductImage name={name} url={url} className={className} />

  return (
    <div className={cn("group relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        className="relative block size-full overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={url ? `Cambiar la foto de ${name}` : `Agregar foto a ${name}`}
        title={url ? "Cambiar foto" : "Agregar foto"}
      >
        {url ? (
          <ProductImage name={name} url={url} className="size-full" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <Camera className="size-4" />
            <span className="text-[9px] leading-none font-medium">Foto</span>
          </span>
        )}
        {pending ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-4 animate-spin" />
          </span>
        ) : null}
      </button>
      {url && !pending ? (
        <button
          type="button"
          onClick={remove}
          className="absolute -top-1.5 -right-1.5 hidden size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm group-hover:flex pointer-coarse:flex hover:text-destructive focus-visible:flex"
          aria-label={`Quitar la foto de ${name}`}
          title="Quitar foto"
        >
          <Trash2 className="size-3" />
        </button>
      ) : null}
      <input ref={input} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}
