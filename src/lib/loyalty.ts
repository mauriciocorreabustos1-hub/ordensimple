// Tarjetas de fidelidad: lo que comparten el panel, la tarjeta del cliente y el servidor.

export type LoyaltyModeValue = "STAMPS" | "POINTS"

export type LoyaltyConfig = {
  mode: LoyaltyModeValue
  /** Sellos o puntos para el premio. */
  goal: number
  reward: string | null
  /** Sellos: compra mínima para ganar uno (0 = cualquier compra). */
  minPurchase: number
  /** Puntos: cuánto hay que comprar por punto. */
  pointValue: number
}

/** Sellos o puntos que da una compra. */
export function earnedFor(cfg: LoyaltyConfig, total: number) {
  if (total <= 0) return 0
  if (cfg.mode === "STAMPS") return total >= cfg.minPurchase ? 1 : 0
  return cfg.pointValue > 0 ? Math.floor(total / cfg.pointValue) : 0
}

/** "1 sello", "7 sellos", "1 punto", "340 puntos". */
export function units(mode: LoyaltyModeValue, n: number) {
  const word = mode === "STAMPS" ? "sello" : "punto"
  return `${n.toLocaleString("es-CL")} ${word}${Math.abs(n) === 1 ? "" : "s"}`
}

/** Cómo se gana, en una frase: "1 sello por cada compra desde $5.000". */
export function ruleText(cfg: LoyaltyConfig, money: (n: number) => string) {
  if (cfg.mode === "STAMPS") return cfg.minPurchase > 0 ? `1 sello por cada compra desde ${money(cfg.minPurchase)}` : "1 sello por cada compra"
  return `1 punto por cada ${money(cfg.pointValue)} de compra`
}

export const rewardText = (cfg: LoyaltyConfig) => cfg.reward?.trim() || "un premio"

/** Lo que le falta para el premio, o que ya lo tiene. */
export function progressText(cfg: LoyaltyConfig, balance: number) {
  const missing = cfg.goal - balance
  return missing > 0 ? `Te ${missing === 1 ? "falta" : "faltan"} ${units(cfg.mode, missing)} para ${rewardText(cfg)}` : `¡Ya tienes ${rewardText(cfg)}!`
}

export const loyaltyPath = (token: string) => `/tarjeta/${token}`

/** Mensaje para enviarle la tarjeta al cliente por WhatsApp. */
export function loyaltyWhatsappText(d: { businessName: string; customerName: string; cfg: LoyaltyConfig; url: string; money: (n: number) => string }) {
  const first = d.customerName.split(" ")[0] || d.customerName
  return [
    `¡Hola, ${first}! 👋 Te escribimos de *${d.businessName}*.`,
    "",
    `🎁 Aquí está tu *tarjeta de fidelidad*: con ${units(d.cfg.mode, d.cfg.goal)} te llevas *${rewardText(d.cfg)}*.`,
    `Ganas ${ruleText(d.cfg, d.money)}.`,
    "",
    "Guárdala en tu celular y muéstrala cuando vengas 👇",
    d.url,
  ].join("\n")
}

/** La parte del aviso de la venta que habla de la tarjeta (para sumarla al aviso del formulario). */
export const earnedPart = (message: string | undefined) => message?.match(/ · \+.*$/)?.[0] ?? ""

/** Lo que ganó con una venta, para el aviso al registrarla: "+1 sello para Ana (7 de 10)". */
export type LoyaltyEarned = { customerName: string; mode: LoyaltyModeValue; earned: number; balance: number; goal: number }
export function earnedNote(e: LoyaltyEarned | null | undefined) {
  if (!e) return ""
  const first = e.customerName.split(" ")[0] || e.customerName
  return ` · +${units(e.mode, e.earned)} para ${first} (${e.balance >= e.goal ? "¡premio listo!" : `${e.balance} de ${e.goal}`})`
}
