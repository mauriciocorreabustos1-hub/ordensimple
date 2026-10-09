"use client"

import * as React from "react"
import Script from "next/script"
import { useRouter } from "next/navigation"
import { Loader2, Lock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { startCardSubscription } from "@/server/actions/billing"

type PaidPlan = "PRO" | "BUSINESS"

type CardFormInstance = {
  getCardFormData: () => { token?: string; cardholderEmail?: string }
  unmount: () => void
}
type MercadoPagoSdk = new (
  publicKey: string,
  options: { locale: string },
) => { cardForm: (settings: Record<string, unknown>) => CardFormInstance }

declare global {
  interface Window {
    MercadoPago?: MercadoPagoSdk
  }
}

const ID = "mp-card-form"
const IFRAME_STYLE = { fontSize: "16px" }

const FIELD_LABEL: Record<string, string> = {
  cardNumber: "número de tarjeta",
  expirationDate: "vencimiento",
  expirationMonth: "vencimiento",
  expirationYear: "vencimiento",
  securityCode: "código de seguridad",
  cardholderName: "nombre del titular",
  identificationType: "tipo de documento",
  identificationNumber: "número de documento",
}
// Los recuadros de número, vencimiento y código son iframes seguros de Mercado Pago: se les da el aspecto de un input.
const BOX = "h-10 w-full rounded-md border border-input bg-background px-3 py-2"
// 16 px en el celular: con letra más chica, el iPhone hace zoom al escribir.
const FIELD =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"

/**
 * Pago con tarjeta dentro de OrdenSimple con CardForm de Mercado Pago (el formulario recomendado para suscripciones).
 * Los datos de la tarjeta van directo a Mercado Pago; aquí solo llega un código de un solo uso.
 */
export function CardPayment({
  publicKey,
  plan,
  amount,
  payerEmail,
  onUnavailable,
}: {
  publicKey: string
  plan: PaidPlan
  /** Monto mensual en pesos. */
  amount: number
  payerEmail: string
  /** Si el formulario no carga, se ofrece el otro método. */
  onUnavailable: () => void
}) {
  const router = useRouter()
  const [sdkReady, setSdkReady] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [paying, setPaying] = React.useState(false)
  const formRef = React.useRef<CardFormInstance | null>(null)

  React.useEffect(() => {
    const Sdk = window.MercadoPago
    if (!sdkReady || !Sdk) return
    let instance: CardFormInstance | null = null
    try {
      const mp = new Sdk(publicKey, { locale: "es-CL" })
      instance = mp.cardForm({
        amount: String(amount),
        iframe: true,
        form: {
          id: ID,
          cardNumber: { id: `${ID}-number`, placeholder: "1234 1234 1234 1234", style: IFRAME_STYLE },
          expirationDate: { id: `${ID}-expiration`, placeholder: "MM/AA", style: IFRAME_STYLE },
          securityCode: { id: `${ID}-cvv`, placeholder: "123", style: IFRAME_STYLE },
          cardholderName: { id: `${ID}-name`, placeholder: "Como aparece en la tarjeta" },
          issuer: { id: `${ID}-issuer` },
          installments: { id: `${ID}-installments` },
          identificationType: { id: `${ID}-doc-type` },
          identificationNumber: { id: `${ID}-doc-number`, placeholder: "123456789" },
          cardholderEmail: { id: `${ID}-email` },
        },
        callbacks: {
          onFormMounted: (error: unknown) => {
            if (error) {
              console.error("[mercadopago] formulario de tarjeta", error)
              onUnavailable()
            } else setMounted(true)
          },
          onCardTokenReceived: (error: unknown) => {
            if (!error) return
            console.error("[mercadopago] no se generó el token de la tarjeta", JSON.stringify(error))
            const list = Array.isArray(error) ? error : [error]
            const fields = list
              .map((e) => (e && typeof e === "object" && "field" in e ? String((e as { field: unknown }).field) : ""))
              .filter(Boolean)
            toast.error(
              fields.length
                ? `Revisa estos datos de la tarjeta: ${[...new Set(fields)].map((f) => FIELD_LABEL[f] ?? f).join(", ")}.`
                : "Revisa los datos de la tarjeta.",
            )
          },
          onSubmit: async (event: Event) => {
            event.preventDefault()
            const data = formRef.current?.getCardFormData()
            if (!data?.token) {
              toast.error("Revisa los datos de la tarjeta.")
              return
            }
            setPaying(true)
            const r = await startCardSubscription({ plan, cardToken: data.token, payerEmail: data.cardholderEmail || payerEmail })
            setPaying(false)
            if (!r.ok) return void toast.error(r.message)
            toast.success(r.message ?? "¡Listo!")
            router.refresh()
          },
        },
      })
      formRef.current = instance
    } catch (error) {
      console.error("[mercadopago] no se pudo crear el formulario", error)
      onUnavailable()
    }
    return () => {
      formRef.current = null
      try {
        instance?.unmount()
      } catch {
        // ya estaba desmontado
      }
    }
  }, [sdkReady, publicKey, plan, amount, payerEmail, router, onUnavailable])

  return (
    <div className="space-y-2">
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
        onError={() => onUnavailable()}
      />
      {!mounted ? (
        <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando el formulario seguro de Mercado Pago…
        </p>
      ) : null}
      <form id={ID} className={mounted ? "grid gap-3" : "invisible absolute h-0 overflow-hidden"}>
        <label className="grid gap-1.5 text-sm font-medium">
          Número de tarjeta
          <div id={`${ID}-number`} className={BOX} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Vencimiento
            <div id={`${ID}-expiration`} className={BOX} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            CVV
            <div id={`${ID}-cvv`} className={BOX} />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm font-medium">
          Nombre del titular
          <input id={`${ID}-name`} className={FIELD} autoComplete="cc-name" />
        </label>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Documento
            <select id={`${ID}-doc-type`} className={FIELD} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Número
            <input id={`${ID}-doc-number`} className={FIELD} inputMode="text" />
          </label>
        </div>
        <p className="-mt-1 text-xs text-muted-foreground">
          El RUT del titular de la tarjeta, sin puntos ni guion (ej. 123456789 o 12345678K).
        </p>
        {/* Mercado Pago los necesita en el formulario; las suscripciones se cobran en 1 cuota. */}
        <select id={`${ID}-issuer`} className="hidden" />
        <select id={`${ID}-installments`} className="hidden" />
        <input id={`${ID}-email`} type="email" defaultValue={payerEmail} className="hidden" readOnly />
        <Button type="submit" size="lg" className="h-11 w-full sm:w-auto" disabled={paying}>
          {paying ? <Loader2 className="animate-spin" /> : <Lock />}
          Pagar y activar
        </Button>
      </form>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" />
        Los datos de tu tarjeta los recibe Mercado Pago directamente. OrdenSimple no los ve ni los guarda. No necesitas cuenta de Mercado
        Pago.
      </p>
    </div>
  )
}
