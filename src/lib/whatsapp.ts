/**
 * Enlace para abrir un chat de WhatsApp. Números chilenos de 9 dígitos (ej. 912345678) se completan con +56.
 * Sin número, WhatsApp abre el mensaje listo para elegir a quién mandarlo.
 */
export function whatsappLink(phone: string | null | undefined, text?: string) {
  const digits = (phone ?? "").replace(/\D/g, "")
  const number = digits.length === 9 ? `56${digits}` : digits.length >= 8 ? digits : ""
  // Se usa api.whatsapp.com y no wa.me: al redirigir, wa.me rompe los emojis en algunos WhatsApp (sobre todo en el computador).
  const qs = [number ? `phone=${number}` : null, text ? `text=${encodeURIComponent(text)}` : null].filter(Boolean).join("&")
  return `https://api.whatsapp.com/send${qs ? `?${qs}` : ""}`
}

/** Mensaje amable para cobrar un fiado. */
export function fiadoReminderText({ customerName, businessName, amount, payUrl }: { customerName: string; businessName: string; amount: string; payUrl?: string }) {
  const first = customerName.split(" ")[0] || customerName
  // Con enlace de pago, puede pagar al tiro con tarjeta o Mercado Pago.
  if (payUrl) {
    return `Hola ${first}, ¿cómo estás? Te escribo de ${businessName}. Te recuerdo que tienes un saldo pendiente de ${amount} en fiado. Si quieres, puedes pagarlo aquí con tarjeta o Mercado Pago: ${payUrl} ¡Muchas gracias!`
  }
  return `Hola ${first}, ¿cómo estás? Te escribo de ${businessName}. Te recuerdo que tienes un saldo pendiente de ${amount} en fiado. ¿Cuándo podrías pasar a pagarlo? ¡Muchas gracias!`
}
