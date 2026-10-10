"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, CreditCard, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/app/field"
import { cn } from "@/lib/utils"
import { cancelSubscription, startSubscription } from "@/server/actions/billing"
import { CardPayment } from "@/components/settings/card-payment"

type PaidPlan = "PRO" | "BUSINESS"

export type PlanOption = {
  plan: PaidPlan
  name: string
  /** Precio que se cobrará (con descuento si tiene). */
  priceLabel: string
  /** Precio sin descuento, si es distinto. */
  fullPriceLabel?: string
  /** Monto mensual en pesos que se cobrará. */
  amount: number
  summary: string
}

export type SubscriptionState =
  | { kind: "none" }
  | { kind: "pending"; plan: PaidPlan; payerEmail: string }
  | {
      kind: "active"
      planName: string
      amountLabel: string
      nextLabel: string | null
      payerEmail: string
      status: string
      /** Cobro pausado como regalo de "Invita a un amigo": hasta cuándo. */
      giftPausedLabel?: string | null
    }

/** Contratar o cancelar Pro o Empresa con Mercado Pago (cobro mensual automático). */
export function SubscriptionPanel({
  state,
  options,
  initialPlan,
  defaultEmail,
  canManage,
  publicKey,
}: {
  state: SubscriptionState
  options: PlanOption[]
  initialPlan: PaidPlan
  defaultEmail: string
  canManage: boolean
  /** Clave pública de Mercado Pago: con ella se paga con tarjeta aquí mismo, sin cuenta de Mercado Pago. */
  publicKey?: string
}) {
  const router = useRouter()
  const [plan, setPlan] = React.useState<PaidPlan>(state.kind === "pending" ? state.plan : initialPlan)
  const [email, setEmail] = React.useState(state.kind === "pending" ? state.payerEmail : defaultEmail)
  const [pending, startTransition] = React.useTransition()
  // Por defecto, tarjeta aquí mismo; el pago con cuenta de Mercado Pago queda como alternativa.
  const [method, setMethod] = React.useState<"card" | "account">(state.kind === "pending" ? "account" : "card")
  const [cardUnavailable, setCardUnavailable] = React.useState(false)
  const cardFailed = React.useCallback(() => {
    setCardUnavailable(true)
    toast.error("No se pudo cargar el pago con tarjeta. Puedes pagar con tu cuenta de Mercado Pago.")
  }, [])
  const useCard = Boolean(publicKey) && method === "card" && !cardUnavailable

  if (state.kind === "active") {
    return (
      <div className="space-y-3 rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
        <p className="font-medium">
          {state.giftPausedLabel
            ? "🎁 Cobro en pausa por tus invitaciones"
            : state.status === "authorized"
              ? "Suscripción activa"
              : "Suscripción pausada"}
          : {state.planName} · {state.amountLabel} al mes
        </p>
        <p className="text-muted-foreground">
          {state.giftPausedLabel
            ? `Ganaste días gratis invitando a otros negocios, así que no se te cobra hasta el ${state.giftPausedLabel}. Después tu suscripción sigue sola con Mercado Pago a ${state.payerEmail}.`
            : `Se cobra con Mercado Pago a ${state.payerEmail}.${state.nextLabel ? ` Próximo cobro: ${state.nextLabel}.` : ""}`}
        </p>
        {canManage ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm("¿Cancelar la suscripción? No se te cobrará más y tu plan seguirá hasta el final del mes que ya pagaste.")
              )
                return
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
    return <p className="text-sm text-muted-foreground">Solo el dueño del negocio puede contratar un plan.</p>
  }

  const chosen = options.find((o) => o.plan === plan) ?? options[0]

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Elige tu plan">
        {options.map((o) => {
          const selected = o.plan === plan
          return (
            <button
              key={o.plan}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPlan(o.plan)}
              className={cn(
                "space-y-1 rounded-xl border p-3 text-left transition-colors",
                selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">{o.name}</span>
                {selected ? <Check className="size-4 text-primary" /> : null}
              </span>
              <span className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-lg font-semibold">{o.priceLabel}</span>
                <span className="text-xs text-muted-foreground">al mes</span>
                {o.fullPriceLabel ? <span className="text-xs text-muted-foreground line-through">{o.fullPriceLabel}</span> : null}
              </span>
              <span className="block text-xs text-muted-foreground">{o.summary}</span>
            </button>
          )
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        Se cobra solo cada mes con Mercado Pago (tarjeta de crédito o débito). Puedes cancelar cuando quieras desde aquí.
      </p>

      {useCard ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">Paga {chosen.name} con tu tarjeta</p>
          <CardPayment
            key={plan}
            publicKey={publicKey!}
            plan={plan}
            amount={chosen.amount}
            payerEmail={defaultEmail}
            onUnavailable={cardFailed}
          />
          <button type="button" onClick={() => setMethod("account")} className="text-xs text-primary hover:underline">
            Prefiero pagar con mi cuenta de Mercado Pago
          </button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            startTransition(async () => {
              const r = await startSubscription({ payerEmail: email, plan })
              if (!r.ok) return void toast.error(r.message)
              // Se completa el pago en Mercado Pago y se vuelve aquí.
              router.push(r.data!.url)
            })
          }}
        >
          {state.kind === "pending" ? (
            <p className="rounded-lg bg-warning/10 p-3 text-xs">Empezaste una suscripción y falta completar el pago en Mercado Pago.</p>
          ) : null}
          <Field label="¿Con qué correo entras a Mercado Pago?" htmlFor="mp-email" hint="Tiene que ser tu cuenta de Mercado Pago de Chile.">
            <Input id="mp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} className="h-10" />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="submit" size="lg" className="h-11 w-full sm:w-auto" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <CreditCard />}
              {state.kind === "pending" && state.plan === plan
                ? "Completar el pago en Mercado Pago"
                : `Suscribirme a ${chosen.name} con Mercado Pago`}
            </Button>
            {publicKey && !cardUnavailable ? (
              <button type="button" onClick={() => setMethod("card")} className="text-xs text-primary hover:underline">
                Pagar con tarjeta aquí mismo (sin cuenta de Mercado Pago)
              </button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  )
}
