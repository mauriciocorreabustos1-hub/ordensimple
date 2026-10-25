"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Download, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { respondToQuote } from "@/server/actions/quotes"

/** Lo que puede hacer el cliente con la cotización: aceptarla, rechazarla o guardarla en PDF. */
export function QuoteActions({ token, canRespond, fileName }: { token: string; canRespond: boolean; fileName: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState<"accept" | "reject" | null>(null)
  const [confirmReject, setConfirmReject] = React.useState(false)

  async function respond(accept: boolean) {
    setPending(accept ? "accept" : "reject")
    const r = await respondToQuote(token, accept)
    setPending(null)
    if (!r.ok) toast.error(r.message)
    else toast.success(r.message)
    setConfirmReject(false)
    router.refresh()
  }

  function download() {
    // El nombre del PDF sale del título de la página.
    const title = document.title
    document.title = fileName
    window.print()
    document.title = title
  }

  return (
    <div className="no-print space-y-2">
      {canRespond ? (
        confirmReject ? (
          <div className="space-y-2 rounded-2xl border bg-background p-4">
            <p className="text-sm font-medium">¿Rechazar esta cotización?</p>
            <p className="text-sm text-muted-foreground">Le avisaremos al negocio. Si quieres cambiar algo, mejor escríbeles antes.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setConfirmReject(false)} disabled={pending !== null}>
                Volver
              </Button>
              <Button variant="destructive" onClick={() => void respond(false)} disabled={pending !== null}>
                {pending === "reject" ? <Loader2 className="animate-spin" /> : <X />}
                Rechazar
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Button size="lg" className="h-12 text-base" onClick={() => void respond(true)} disabled={pending !== null}>
              {pending === "accept" ? <Loader2 className="animate-spin" /> : <Check />}
              Aceptar cotización
            </Button>
            <Button size="lg" variant="outline" className="h-12" onClick={() => setConfirmReject(true)} disabled={pending !== null}>
              No, gracias
            </Button>
          </div>
        )
      ) : null}
      <Button variant="outline" className="w-full" onClick={download}>
        <Download />
        Descargar en PDF o imprimir
      </Button>
    </div>
  )
}
