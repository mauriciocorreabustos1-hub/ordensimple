// Cuándo avisar que un plan vence. Sin dependencias del servidor: lo usan el aviso diario, el aviso en la app y las pruebas.
// Se cuenta en días de calendario (en la zona del negocio), para que "en 3 días" siempre calce con la fecha que se muestra.

/** Primer aviso: cuando quedan 5 días o menos. Segundo aviso: el día que vence. */
export const PLAN_NOTICE_DAYS = 5

/** Días de calendario entre dos fechas AAAA-MM-DD (positivo si `to` es después). */
export function calendarDaysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
}

/** En qué aviso va un plan que vence en `days` días de calendario (null: todavía no toca, o venció hace más de un día). */
export function planNoticeStage(days: number): "5" | "0" | null {
  if (days < -1) return null
  if (days <= 0) return "0"
  if (days <= PLAN_NOTICE_DAYS) return "5"
  return null
}

/** ¿Ya se mandó este aviso (o uno posterior para la misma fecha)? */
export function alreadyNotified(lastKey: string | null, expiresDay: string, stage: "5" | "0") {
  return lastKey === `${expiresDay}:${stage}` || (stage === "5" && lastKey === `${expiresDay}:0`)
}

/** "el sábado 28 de noviembre" (sin la coma que pone el formato de fecha). */
export const cleanDateLabel = (label: string) => label.replace(/,\s*/g, " ")
