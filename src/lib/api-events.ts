// Eventos de los avisos (webhooks) de la API v1. Sin dependencias de servidor: lo usa también la pantalla.

export const WEBHOOK_EVENTS = ["cliente.creado", "cliente.actualizado", "orden.creada", "orden.actualizada"] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]
export const WEBHOOK_EVENT_LABEL: Record<WebhookEvent, string> = {
  "cliente.creado": "Cliente nuevo",
  "cliente.actualizado": "Cliente modificado",
  "orden.creada": "Venta o cotización nueva",
  "orden.actualizada": "Venta o cotización modificada",
}
export const MAX_WEBHOOKS = 5
