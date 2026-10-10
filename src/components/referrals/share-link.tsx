"use client"

import * as React from "react"
import { Check, Copy, MessageCircle, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { whatsappLink } from "@/lib/whatsapp"

/** Enlace de invitación con botones para copiarlo, mandarlo por WhatsApp o compartirlo. */
export function ShareLink({ url, message }: { url: string; message: string }) {
  const [copied, setCopied] = React.useState(false)
  const [canShare, setCanShare] = React.useState(false)
  React.useEffect(() => {
    // Se revisa después de montar para que el servidor y el navegador dibujen lo mismo la primera vez.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator.share === "function")
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Enlace copiado")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("No se pudo copiar. Mantén presionado el enlace para copiarlo.")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border bg-background/70 p-1.5 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-sm select-all" title={url}>
          {url}
        </span>
        <Button size="sm" variant="outline" className="shrink-0 bg-background" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="h-11 flex-1 bg-[#25D366] text-white hover:bg-[#1fb757]" asChild>
          <a href={whatsappLink(null, message)} target="_blank" rel="noopener noreferrer">
            <MessageCircle />
            Mandar por WhatsApp
          </a>
        </Button>
        {canShare ? (
          <Button
            variant="outline"
            className="h-11 flex-1"
            onClick={() => void navigator.share({ title: "OrdenSimple", text: message }).catch(() => {})}
          >
            <Share2 />
            Compartir de otra forma
          </Button>
        ) : null}
      </div>
    </div>
  )
}
