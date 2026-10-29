"use client"

import * as React from "react"
import { toast } from "sonner"
import { fiadoReminderText, whatsappLink } from "@/lib/whatsapp"
import { debtPaymentLink } from "@/server/actions/online-payments"
import { isNativeApp } from "@/lib/native-app"

/**
 * "Cobrar" el fiado por WhatsApp. Si el negocio tiene Mercado Pago conectado, el mensaje lleva un enlace para pagar
 * el saldo de hoy con tarjeta (al pagarse queda como abono). Si no, es el recordatorio de siempre.
 */
export function DebtReminderButton({
  customerId,
  customerName,
  phone,
  businessName,
  amountText,
  onlinePay,
  className,
  title,
  ariaLabel,
  children,
}: {
  customerId: string
  customerName: string
  phone: string | null
  businessName: string
  /** Lo que debe, ya con formato ($12.500). */
  amountText: string
  /** El negocio puede cobrar online (Mercado Pago conectado). */
  onlinePay: boolean
  className?: string
  title?: string
  ariaLabel?: string
  children: React.ReactNode
}) {
  const [busy, setBusy] = React.useState(false)
  const plain = whatsappLink(phone, fiadoReminderText({ customerName, businessName, amount: amountText }))

  async function withLink(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!onlinePay) return
    e.preventDefault()
    if (busy) return
    // La pestaña se abre al tiro (si no, el navegador la bloquea) y se llena cuando está el enlace.
    // En la app no hay pestañas: WhatsApp se abre al tener el enlace.
    const tab = isNativeApp() ? null : window.open("", "_blank")
    setBusy(true)
    const r = await debtPaymentLink(customerId)
    setBusy(false)
    if (!r.ok || !r.data) {
      toast.error(r.message ?? "No se pudo crear el enlace de pago. Te dejamos el recordatorio sin enlace.")
      if (tab) tab.location.href = plain
      else window.location.href = plain
      return
    }
    const url = whatsappLink(phone, fiadoReminderText({ customerName, businessName, amount: amountText, payUrl: `${window.location.origin}${r.data.path}` }))
    if (tab) tab.location.href = url
    else window.location.href = url
  }

  return (
    <a href={plain} onClick={(e) => void withLink(e)} target="_blank" rel="noopener noreferrer" className={className} title={title} aria-label={ariaLabel} aria-busy={busy}>
      {children}
    </a>
  )
}
