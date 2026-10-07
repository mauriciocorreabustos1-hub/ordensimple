/**
 * Enlace para abrir un chat de WhatsApp. Números chilenos de 9 dígitos (ej. 912345678) se completan con +56.
 * Sin número, WhatsApp abre el mensaje listo para elegir a quién mandarlo.
 */
export function whatsappLink(phone: string | null | undefined, text?: string) {
  const digits = (phone ?? "").replace(/\D/g, "")
  const number = digits.length === 9 ? `56${digits}` : digits.length >= 8 ? digits : ""
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`
}

/** Mensaje amable para cobrar un fiado. */
export function fiadoReminderText({ customerName, businessName, amount }: { customerName: string; businessName: string; amount: string }) {
  const first = customerName.split(" ")[0] || customerName
  return `Hola ${first}, ¿cómo estás? Te escribo de ${businessName}. Te recuerdo que tienes un saldo pendiente de ${amount} en fiado. ¿Cuándo podrías pasar a pagarlo? ¡Muchas gracias!`
}
