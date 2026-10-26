"use client"

import * as React from "react"
import { CreditCard, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { payLink, payQuote, payWebOrder } from "@/server/actions/online-payments"

/** Botón para pagar con Mercado Pago: crea el cobro y lleva a la página de pago. */
export function PayButton({ kind, token, label, className }: { kind: "order" | "quote" | "link"; token: string; label: string; className?: string }) {
  const [pending, setPending] = React.useState(false)
  async function pay() {
    setPending(true)
    const r = kind === "order" ? await payWebOrder(token) : kind === "quote" ? await payQuote(token) : await payLink(token)
    if (!r.ok || !r.data) {
      setPending(false)
      return void toast.error(r.message ?? "No se pudo iniciar el pago.")
    }
    window.location.href = r.data.url
  }
  return (
    <Button size="lg" className={cn("h-12 w-full text-base", className)} onClick={() => void pay()} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <CreditCard />}
      {label}
    </Button>
  )
}

/** Aviso al volver de Mercado Pago (?pago=ok | pendiente | error). */
export function PayResult({ result }: { result: string | undefined }) {
  if (!result) return null
  const text =
    result === "ok"
      ? "¡Pago recibido! Gracias. El negocio ya tiene el aviso."
      : result === "pendiente"
        ? "Tu pago está en revisión. Te confirmamos aquí apenas Mercado Pago lo apruebe."
        : "El pago no se completó. Puedes intentar de nuevo."
  return (
    <p
      className={cn(
        "no-print rounded-2xl border p-4 text-sm font-medium",
        result === "ok" ? "border-success/30 bg-success/10 text-success" : result === "pendiente" ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {text}
    </p>
  )
}
