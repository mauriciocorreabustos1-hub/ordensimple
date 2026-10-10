/** "Invita a un amigo": textos y reglas que se usan tanto en el servidor como en pantalla. */

export const REFERRAL_COOKIE = "os_amigo"
/** 60 días: si llega con el enlace y se registra después, igual cuenta. */
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 60

export const REFERRAL_CODE_RE = /^[a-z0-9-]{4,24}$/

export const REFERRAL_TRIGGERS = [
  { value: "REGISTRO", label: "Cuando el invitado crea su negocio", short: "al crear su negocio" },
  { value: "VENTAS", label: "Cuando el invitado registra sus primeras ventas", short: "al registrar sus primeras ventas" },
  { value: "PAGO", label: "Cuando el invitado paga su primer mes", short: "al pagar su primer mes" },
] as const
export type ReferralTrigger = (typeof REFERRAL_TRIGGERS)[number]["value"]

export function triggerText(trigger: string, minSales: number) {
  if (trigger === "VENTAS") return `cuando registre ${minSales} ${minSales === 1 ? "venta" : "ventas"}`
  if (trigger === "PAGO") return "cuando pague su primer mes"
  return "apenas cree su negocio"
}

/** Lee el código de invitación desde el encabezado Cookie. */
export function parseReferralCookie(cookieHeader: string | null | undefined) {
  const raw = cookieHeader
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${REFERRAL_COOKIE}=`))
    ?.slice(REFERRAL_COOKIE.length + 1)
  return raw && REFERRAL_CODE_RE.test(raw) ? raw : null
}

/** Mensaje para compartir por WhatsApp. */
export function referralShareText(url: string, invitedDays: number, planName: string) {
  return invitedDays > 0
    ? `Uso OrdenSimple para llevar las ventas, gastos y el inventario de mi negocio, y me ha servido harto. Si te registras con mi enlace te regalan ${invitedDays} días del plan ${planName}: ${url}`
    : `Uso OrdenSimple para llevar las ventas, gastos y el inventario de mi negocio, y me ha servido harto. Pruébalo gratis con mi enlace: ${url}`
}
