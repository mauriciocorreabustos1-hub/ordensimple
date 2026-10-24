"use client"

import * as React from "react"
import { FileDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useRollWidth } from "@/components/print/roll-print"
import { ticketToPdf, type Ticket } from "@/lib/ticket"

/** Caracteres por línea en el PDF: algo menos que en la impresora, para que la letra se lea bien en el teléfono. */
const PDF_CHARS = { 58: 30, 80: 40 } as const

/**
 * Boleta en PDF del tamaño del rollo. En el teléfono abre el menú Compartir (a la app de la impresora, AirPrint,
 * WhatsApp o Archivos); en el computador la descarga.
 */
export function PdfTicketButton({ build, fileName, disabled }: { build: () => Ticket; fileName: string; disabled?: boolean }) {
  const [width] = useRollWidth()
  const [pending, setPending] = React.useState(false)

  async function run() {
    setPending(true)
    try {
      const bytes = await ticketToPdf(build(), width, PDF_CHARS[width])
      const file = new File([bytes as BlobPart], `${fileName}.pdf`, { type: "application/pdf" })
      // En el teléfono: el menú Compartir (si el navegador puede compartir archivos).
      const mobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      if (mobile && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: fileName })
          return
        } catch (error) {
          // Si la persona cerró el menú, no es un error; si falló, se descarga.
          if (error instanceof Error && error.name === "AbortError") return
        }
      }
      const url = URL.createObjectURL(file)
      const a = document.createElement("a")
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      toast.error("No se pudo crear el PDF. Vuelve a intentar.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Button variant="outline" onClick={() => void run()} disabled={disabled || pending}>
      {pending ? <Loader2 className="animate-spin" /> : <FileDown />}
      Descargar PDF
    </Button>
  )
}
