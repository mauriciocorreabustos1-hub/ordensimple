// Los rubros del archivador "¿Qué negocio tienes?" del inicio. El menú "Soluciones" lleva a cada uno con /#rubro-<id>.

export const BUSINESS_TYPES = [
  { id: "almacen", label: "Almacén o minimarket", hint: "Etiquetas, ofertas y fiado" },
  { id: "comida", label: "Restaurante o café", hint: "Comandas por mesa y cocina" },
  { id: "servicios", label: "Peluquería o consulta", hint: "Agenda y reservas por internet" },
  { id: "whatsapp", label: "Vendo por WhatsApp", hint: "Tienda online con pedidos" },
  { id: "taller", label: "Taller o ferretería", hint: "Cotizaciones con enlace" },
  { id: "propio", label: "Hago lo que vendo", hint: "Costo real de cada receta" },
] as const

export type BusinessTypeId = (typeof BUSINESS_TYPES)[number]["id"]

export const businessTypeHref = (id: BusinessTypeId) => `/#rubro-${id}`

/** Evento para abrir un rubro estando ya en el inicio: Next cambia la dirección sin avisar con "hashchange". */
export const BUSINESS_TYPE_EVENT = "ordensimple:rubro"

/** Al tocar un rubro del menú estando en el inicio, abre esa pestaña sin recargar la página. */
export function openBusinessTypeHere(e: { preventDefault: () => void }, href: string, pathname: string) {
  if (pathname !== "/" || !href.startsWith("/#rubro-")) return
  e.preventDefault()
  history.replaceState(history.state, "", href)
  window.dispatchEvent(new Event(BUSINESS_TYPE_EVENT))
}
