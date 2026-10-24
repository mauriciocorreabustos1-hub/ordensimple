// Datos de contacto de OrdenSimple (un solo lugar para cambiarlos).

export const CONTACT_EMAIL = "contacto@ordensimple.cl"

const WHATSAPP_PHONE = "+56956743643"

export const WHATSAPP = {
  /** Como se muestra: +56 9 5674 3643 */
  display: "+56 9 5674 3643",
  /** Para el enlace y los datos estructurados (formato internacional). */
  phone: WHATSAPP_PHONE,
  /** Enlace para abrir el chat, con un primer mensaje ya escrito. */
  link: (text = "Hola, quiero saber más de OrdenSimple") => `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE.slice(1)}&text=${encodeURIComponent(text)}`,
}
