// Datos de contacto de OrdenSimple (un solo lugar para cambiarlos).

export const CONTACT_EMAIL = "contacto@ordensimple.cl"

export const WHATSAPP = {
  /** Como se muestra: +56 9 5459 1736 */
  display: "+56 9 5459 1736",
  /** Para el enlace y los datos estructurados (formato internacional). */
  phone: "+56954591736",
  /** Enlace para abrir el chat, con un primer mensaje ya escrito. */
  link: (text = "Hola, quiero saber más de OrdenSimple") => `https://wa.me/56954591736?text=${encodeURIComponent(text)}`,
}
