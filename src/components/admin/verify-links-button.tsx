"use client"

import * as React from "react"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { sendVerifyLinks } from "@/server/actions/admin"

/** Botón del panel: manda el enlace de confirmación (con confirmación antes, porque envía correos). */
export function VerifyLinksButton({ pending }: { pending: number }) {
  const [busy, startTransition] = React.useTransition()
  const batch = Math.min(80, pending)
  return (
    <Button
      disabled={busy || pending === 0}
      onClick={() => {
        if (!window.confirm(`Se enviará el enlace para confirmar el correo a ${batch} ${batch === 1 ? "persona" : "personas"}. ¿Continuar?`)) return
        startTransition(async () => {
          const r = await sendVerifyLinks()
          if (r.ok) toast.success(r.message ?? "Enviado")
          else toast.error(r.message)
        })
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Send />}
      {pending ? `Enviar enlace a ${batch}` : "Ya se les envió a todos"}
    </Button>
  )
}
