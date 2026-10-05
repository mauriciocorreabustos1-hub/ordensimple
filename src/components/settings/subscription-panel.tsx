"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CreditCard, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/app/field"
import { cancelSubscription, startSubscription } from "@/server/actions/billing"

export type SubscriptionState =
  | { kind: "none" }
  | { kind: "pending"; checkoutUrl: string | null; payerEmail: string }
  | { kind: "active"; amountLabel: string; nextLabel: string | null; payerEmail: string; status: string }

/** Contratar o cancelar Pro con Mercado Pago (cobro mensual automático). */
export function SubscriptionPanel({
  state,
  priceLabel,
  fullPriceLabel,
  defaultEmail,
  canManage,
}: {
  state: SubscriptionState
  /** Precio que se cobrará (con descuento si tiene). */
  priceLabel: string
  /** Precio sin descuento, si es distinto. */
  fullPriceLabel?: string
  defaultEmail: string
  canManage: boolean
}) {
  const router = useRouter()
  const [email, setEmail] = React.useState(state.kind === "pending" ? state.payerEmail : defaultEmail)
  const [pending, startTransition] = React.useTransition()

  if (state.kind === "active") {
    return (
      <div className="space-y-3 rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
        <p className="font-medium">
          {state.status === "authorized" ? "Suscripción activa" : "Suscripción pausada"} · {state.amountLabel} al mes
        </p>
        <p className="text-muted-foreground">
          Se cobra con Mercado Pago a {state.payerEmail}.
          {state.nextLabel ? ` Próximo cobro: ${state.nextLabel}.` : ""}
        </p>
        {canManage ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("¿Cancelar la suscripción? No se te cobrará más y Pro seguirá hasta el final del mes que ya pagaste.")) return
              startTransition(async () => {
                const r = await cancelSubscription()
                if (r.ok) {
                  toast.success(r.message ?? "Suscripción cancelada")
                  router.refresh()
                } else toast.error(r.message)
              })
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Cancelar suscripción
          </Button>
        ) : null}
      </div>
    )
  }

  if (!canManage) {
    return <p className="text-sm text-muted-foreground">Solo el dueño del negocio puede contratar Pro.</p>
  }

  return (
    <form
      className="space-y-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const r = await startSubscription({ payerEmail: email })
          if (!r.ok) return void toast.error(r.message)
          // Se completa el pago en Mercado Pago y se vuelve aquí.
          router.push(r.data!.url)
        })
      }}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-base font-semibold">Pro: {priceLabel} al mes</p>
        {fullPriceLabel ? <p className="text-sm text-muted-foreground line-through">{fullPriceLabel}</p> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Se cobra solo cada mes con Mercado Pago (tarjeta de crédito o débito). Puedes cancelar cuando quieras desde aquí.
      </p>
      {state.kind === "pending" ? (
        <p className="rounded-lg bg-warning/10 p-3 text-xs">Empezaste una suscripción y falta completar el pago en Mercado Pago.</p>
      ) : null}
      <Field label="¿Con qué correo entras a Mercado Pago?" htmlFor="mp-email" hint="Tiene que ser tu cuenta de Mercado Pago de Chile.">
        <Input id="mp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} className="h-10" />
      </Field>
      <Button type="submit" size="lg" className="h-11 w-full sm:w-auto" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <CreditCard />}
        {state.kind === "pending" ? "Completar el pago en Mercado Pago" : "Suscribirme con Mercado Pago"}
      </Button>
    </form>
  )
}
