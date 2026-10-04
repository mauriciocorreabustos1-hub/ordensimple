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
  description: string
  maxBusinesses: number
  maxProducts: number | null
  maxMembers: number
  features: PlanFeature[]
  highlights: string[]
}

// Los cobros aún no están implementados: todos los negocios nuevos parten en FREE.
export const PLANS: Record<Plan, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Gratis",
    priceLabel: "$0",
    description: "Para empezar a ordenar tu negocio.",
    maxBusinesses: 1,
    maxProducts: 50,
    maxMembers: 1,
    features: ["tools"],
    highlights: ["1 negocio", "Hasta 50 productos", "Ventas y gastos", "Cierre de caja", "Panel de inicio", "Calculadoras"],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    // Las funciones Pro ya están abiertas a todos; lo que falta es el cobro.
    priceLabel: "Gratis por ahora",
    priceNote: "Durante el lanzamiento. Te avisaremos 30 días antes de empezar a cobrar.",
    description: "Para negocios que quieren crecer con datos.",
    maxBusinesses: 3,
    maxProducts: null,
    maxMembers: 3,
    features: ["inventory", "customers", "suppliers", "tools", "reports", "tips"],
    highlights: [
      "Productos ilimitados",
      "Inventario y alertas de stock",
      "Clientes y fiado",
      "Proveedores",
      "Reportes y consejos automáticos",
      "Hasta 3 personas en tu equipo",
    ],
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Empresa",
    priceLabel: "Próximamente",
    priceNote: "Estamos terminando las sucursales.",
    description: "Para equipos y varias sucursales.",
    maxBusinesses: 10,
    maxProducts: null,
    maxMembers: 50,
    features: ["inventory", "customers", "suppliers", "tools", "reports", "tips", "multiUser", "branches"],
    highlights: ["Todo lo de Pro", "Múltiples usuarios", "Múltiples sucursales", "Roles avanzados", "Reportes avanzados"],
  },
}

/**
 * Mientras no existan los cobros, todas las funciones están abiertas (período de lanzamiento).
 * Para exigir el plan, definir ENFORCE_PLANS=true en las variables de entorno.
 */
export const PLANS_ENFORCED = process.env.ENFORCE_PLANS === "true"

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
