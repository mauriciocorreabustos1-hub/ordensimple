import type { Plan } from "@/generated/prisma/enums"

export type PlanFeature =
  | "inventory"
  | "customers"
  | "suppliers"
  | "tools"
  | "reports"
  | "tips"
  | "multiUser"
  | "branches"

type PlanConfig = {
  id: Plan
  name: string
  priceLabel: string
  /** Texto bajo el precio (por ejemplo, mientras dura el lanzamiento). */
  priceNote?: string
  /** Precio mensual en CLP para la suscripción (null = no se puede contratar todavía). */
  monthlyPrice: number | null
  description: string
  maxBusinesses: number
  maxProducts: number | null
  maxMembers: number
  features: PlanFeature[]
  highlights: string[]
}

/**
 * Cobro con Mercado Pago (BILLING_ENABLED=true): se muestran los precios, se puede contratar Pro o Empresa
 * y se aplican los límites del plan Gratis. Apagado = período de lanzamiento (todo abierto, sin precios).
 */
export const BILLING_ENABLED = process.env.BILLING_ENABLED === "true"

// Todos los negocios nuevos parten en FREE; Pro y Empresa se contratan con Mercado Pago.
export const PLANS: Record<Plan, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Gratis",
    priceLabel: "$0",
    monthlyPrice: null,
    description: "Para empezar a ordenar tu negocio.",
    maxBusinesses: 1,
    maxProducts: 50,
    maxMembers: 6, // tú + 5 trabajadores
    features: ["tools"],
    highlights: ["1 negocio", "Tú + 5 trabajadores", "Hasta 50 productos", "Ventas y gastos", "Cierre de caja", "Panel de inicio", "Calculadoras"],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    // Las funciones Pro ya están abiertas a todos; lo que falta es el cobro.
    priceLabel: BILLING_ENABLED ? "$6.990" : "Gratis por ahora",
    priceNote: BILLING_ENABLED ? "al mes · cancelas cuando quieras" : "Durante el lanzamiento. Te avisaremos 5 días antes de empezar a cobrar.",
    monthlyPrice: 6990,
    description: "Para negocios que quieren crecer con datos.",
    maxBusinesses: 3,
    maxProducts: null,
    maxMembers: 21, // tú + 20 trabajadores
    features: ["inventory", "customers", "suppliers", "tools", "reports", "tips"],
    highlights: [
      "Productos ilimitados",
      "Inventario y alertas de stock",
      "Clientes y fiado",
      "Proveedores",
      "Reportes y consejos automáticos",
      "Tú + 20 trabajadores",
      "Hasta 3 sucursales",
    ],
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Empresa",
    priceLabel: BILLING_ENABLED ? "$14.990" : "Próximamente",
    priceNote: BILLING_ENABLED ? "al mes · cancelas cuando quieras" : "Aún no se puede contratar. Por ahora puedes tener hasta 3 sucursales gratis.",
    monthlyPrice: 14990,
    description: "Para equipos y varias sucursales.",
    maxBusinesses: 10,
    maxProducts: null,
    maxMembers: 1000, // más de 50 trabajadores
    features: ["inventory", "customers", "suppliers", "tools", "reports", "tips", "multiUser", "branches"],
    highlights: ["Todo lo de Pro", "Más de 50 trabajadores", "Hasta 10 sucursales", "Resumen de todas tus sucursales juntas"],
  },
}

/**
 * ¿Se exige el plan? Sí cuando el cobro está encendido y Mercado Pago configurado (nunca se bloquea a
 * alguien que no tenga cómo pagar), o con ENFORCE_PLANS=true. Si no, todo abierto (lanzamiento).
 */
export const PLANS_ENFORCED =
  process.env.ENFORCE_PLANS === "true" || (BILLING_ENABLED && Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN))

/** Planes que se pueden contratar con suscripción mensual. */
export const PAID_PLANS = ["PRO", "BUSINESS"] as const satisfies Plan[]
export type PaidPlan = (typeof PAID_PLANS)[number]


/** Precio con el descuento ganado con un código (redondeado a pesos). */
export function discountedPrice(price: number, discountPercent: number | null | undefined) {
  return discountPercent ? Math.round((price * (100 - discountPercent)) / 100) : price
}

export function planHas(plan: Plan, feature: PlanFeature) {
  return PLANS[plan].features.includes(feature)
}

/** ¿Puede este negocio usar la función? Considera el período de lanzamiento. */
export function canUseFeature(plan: Plan, feature: PlanFeature) {
  return !PLANS_ENFORCED || planHas(plan, feature)
}

export const PLAN_RANK: Record<Plan, number> = { FREE: 0, PRO: 1, BUSINESS: 2 }

/** Plan vigente: si el plan pagado o regalado ya venció, el negocio vuelve a Gratis. */
export function effectivePlan(business: { plan: Plan; planExpiresAt?: Date | null }, now = new Date()): Plan {
  if (business.plan !== "FREE" && business.planExpiresAt && business.planExpiresAt <= now) return "FREE"
  return business.plan
}

/** Texto corto de lo que entrega un código. */
export function couponSummary(c: { kind: "FREE_DAYS" | "PERCENT"; plan: Plan; days: number | null; percentOff: number | null }) {
  return c.kind === "FREE_DAYS"
    ? `${c.days} días gratis del plan ${PLANS[c.plan].name}`
    : `${c.percentOff}% de descuento en el plan ${PLANS[c.plan].name}`
}

/**
 * Personas que pueden usar un negocio (incluido el dueño). Durante el lanzamiento todos
 * pueden invitar como en Pro; con ENFORCE_PLANS=true se aplica el límite de cada plan.
 */
export function memberLimit(plan: Plan) {
  return PLANS_ENFORCED ? PLANS[plan].maxMembers : Math.max(PLANS[plan].maxMembers, PLANS.PRO.maxMembers)
}

/** Máximo de productos (null = sin límite). Durante el lanzamiento no hay límite, como en Pro. */
export function productLimit(plan: Plan) {
  return PLANS_ENFORCED ? PLANS[plan].maxProducts : null
}

/** Negocios o sucursales que una persona puede tener como dueña. Durante el lanzamiento, como en Pro. */
export function businessLimit(plan: Plan) {
  return PLANS_ENFORCED ? PLANS[plan].maxBusinesses : Math.max(PLANS[plan].maxBusinesses, PLANS.PRO.maxBusinesses)
}
