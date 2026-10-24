"use client"

import * as React from "react"
import { FileDown, ImageDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useRollWidth } from "@/components/print/roll-print"
import { ROLL_DOTS, ticketToImages, ticketToPdf, type Ticket } from "@/lib/ticket"

/** Caracteres por línea en el PDF y la imagen: algo menos que en la impresora, para que la letra se lea bien. */
const FILE_CHARS = { 58: 30, 80: 40 } as const

/** En el teléfono abre el menú Compartir (si el navegador puede compartir archivos); si no, los descarga. */
async function deliver(files: File[], title: string) {
  const mobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  if (mobile && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title })
      return
    } catch (error) {
      // Si la persona cerró el menú, no es un error; si falló, se descarga.
      if (error instanceof Error && error.name === "AbortError") return
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file)
    const a = document.createElement("a")
    a.href = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

/**
 * La boleta como archivo del tamaño del rollo: PDF, o imagen del ancho exacto que imprime la térmica (la que mejor
 * reciben las apps de las impresoras). En el teléfono abre el menú Compartir; en el computador la descarga.
 */
export function TicketFileButtons({ build, fileName, disabled }: { build: () => Ticket; fileName: string; disabled?: boolean }) {
  const [width] = useRollWidth()
  const [pending, setPending] = React.useState<"pdf" | "image" | null>(null)

  async function run(kind: "pdf" | "image") {
    setPending(kind)
    try {
      if (kind === "pdf") {
        const bytes = await ticketToPdf(build(), width, FILE_CHARS[width])
        await deliver([new File([bytes as BlobPart], `${fileName}.pdf`, { type: "application/pdf" })], fileName)
      } else {
        const images = await ticketToImages(build(), ROLL_DOTS[width], FILE_CHARS[width])
        const files = images.map((b, i) => new File([b], images.length > 1 ? `${fileName} (${i + 1}).png` : `${fileName}.png`, { type: "image/png" }))
        await deliver(files, fileName)
      }
    } catch {
      toast.error("No se pudo crear el archivo. Vuelve a intentar.")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => void run("image")} disabled={disabled || pending !== null}>
        {pending === "image" ? <Loader2 className="animate-spin" /> : <ImageDown />}
        Boleta en imagen
      </Button>
      <Button variant="outline" onClick={() => void run("pdf")} disabled={disabled || pending !== null}>
        {pending === "pdf" ? <Loader2 className="animate-spin" /> : <FileDown />}
        Descargar PDF
      </Button>
    </div>
  )
}
