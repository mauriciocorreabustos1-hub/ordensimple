import { WhatsAppIcon } from "@/components/landing/social-links"
import { WHATSAPP } from "@/lib/contact"

/** Botón flotante para escribirnos por WhatsApp desde la página pública. */
export function WhatsAppFloat() {
  return (
    <a
      href={WHATSAPP.link()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Escríbenos por WhatsApp (${WHATSAPP.display})`}
      className="group fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-[#25d366] p-3.5 text-white shadow-xl transition-transform hover:scale-105 sm:pr-5"
    >
      <WhatsAppIcon className="size-7" />
      <span className="hidden text-sm font-semibold sm:inline">¿Dudas? Escríbenos</span>
    </a>
  )
}
