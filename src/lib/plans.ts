import type { Plan } from "@/generated/prisma/enums"

export type PlanFeature =
  | "inventory"
  | "customers"
  | "suppliers"
  | "tools"
  | "reports"
  | "tips"
  /** Resultados e IVA (estado de resultados, utilidad y F29). */
  | "results"
  /** Descargar ventas, gastos y resultados en Excel. */
  | "exports"
  /** Flujo de caja de meses anteriores y lo que viene (pagos a proveedores y fiado por cobrar). */
  | "cashflowPlus"
  /** Merma y vencidos: registrar pérdidas y avisos de productos por vencer. */
  | "waste"
  /** Reportes de cualquier fecha (en Gratis: este mes y el anterior). */
  | "history"
  /** Escaneo continuo al vender (la cámara queda abierta, como en una caja). */
  | "fastScan"
  /** Balance (lo que tienes y lo que debes), retiros del dueño y préstamos. */
  | "balance"
  /** Cierre de caja diario. */
  | "cashClose"
  /** Flujo de caja (en Pro, también meses anteriores y lo que viene: ver cashflowPlus). */
  | "cashflow"
  /** Comandas: cuentas abiertas por mesa o pedido (solo para negocios de comida). */
  | "comandas"
  /** Promociones automáticas (2×1, %, happy hour) y cupones para la tienda online. */
  | "promos"
  /** Tienda online: catálogo público con pedidos por WhatsApp. */
  | "store"
  /** Agenda de citas (peluquerías, consultas, talleres…). */
  | "agenda"
  /** Cotizaciones con enlace para que el cliente las acepte. */
  | "quotes"
  /** Tarjetas de fidelidad con sellos o puntos. */
  | "loyalty"
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
  /** Para quién es (se muestra en precios). */
  audience: string
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
    priceNote: "Para siempre, sin tarjeta",
    monthlyPrice: null,
    description: "Para empezar a ordenar tus ventas y gastos.",
    audience: "Quien recién parte y atiende solo",
    maxBusinesses: 1,
    maxProducts: 20,
    maxMembers: 1, // solo el dueño
    // Gratis: lo básico, anotar ventas y gastos, saber cuánto queda, inventario, clientes y fiado, los reportes de este mes y el anterior y las calculadoras.
    features: ["inventory", "customers", "reports", "tools"],
    highlights: [
      "1 negocio, solo tú",
      "Ventas y gastos sin límite",
      "Cobros con tarjeta: enlaces de pago con Mercado Pago (1 % por pago)",
      "Hasta 20 productos",
      "Inventario, alertas de stock y aviso de productos por vencer",
      "Recetas: costo y precio de venta",
      "Cuánto te quedó hoy y en el mes",
      "Clientes y fiado, con cobro por WhatsApp",
      "Reportes de este mes y el anterior",
      "Calculadoras: precio de venta, metas y simulador",
      "Resumen por correo cada lunes",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    // Las funciones Pro ya están abiertas a todos; lo que falta es el cobro.
    priceLabel: BILLING_ENABLED ? "$6.990" : "Gratis por ahora",
    priceNote: BILLING_ENABLED ? "al mes, cancelas cuando quieras" : "Durante el lanzamiento. Te avisaremos 5 días antes de empezar a cobrar.",
    monthlyPrice: 6990,
    description: "Para pymes que crecen y quieren tener todo ordenado.",
    audience: "Pymes con equipo, proveedores y que declaran IVA",
    maxBusinesses: 3,
    maxProducts: null,
    maxMembers: 21, // tú + 20 trabajadores
    features: ["inventory", "customers", "suppliers", "tools", "reports", "tips", "results", "exports", "cashClose", "cashflow", "cashflowPlus", "waste", "history", "fastScan", "balance", "comandas", "store", "agenda", "promos", "quotes", "loyalty"],
    highlights: [
      "Todo lo de Gratis, y además:",
      "Tienda online con fotos: pedidos por WhatsApp o pagados con tarjeta",
      "Agenda de horas: tus clientes reservan solos desde tu tienda",
      "Comandas por mesa, carta con QR y cuenta separada por persona",
      "Promociones (2×1, descuentos, happy hour) y cupones",
      "Cotizaciones con enlace: tu cliente las revisa y acepta",
      "Tarjeta de fidelidad con sellos o puntos en el celular del cliente",
      "Cobros online en tu tienda y tus cotizaciones (1 % por pago)",
      "Resultados e IVA: tu utilidad real y una estimación de tu F29 (IVA + PPM)",
      "Productos ilimitados",
      "Tú + 20 trabajadores y hasta 3 sucursales",
      "Cierre de caja diario",
      "Reportes de cualquier fecha y consejos",
      "Flujo de caja con lo que viene: pagos y fiado por cobrar",
      "Balance: cuánto vale tu negocio, retiros del dueño y préstamos",
      "Proveedores y pagos pendientes con recordatorio",
      "Merma: cuánto pierdes por productos vencidos o dañados",
      "Escaneo continuo: vende como en caja de supermercado",
      "Ventas, gastos y resultados en Excel",
    ],
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Empresa",
    priceLabel: BILLING_ENABLED ? "$14.990" : "Próximamente",
    priceNote: BILLING_ENABLED ? "al mes, cancelas cuando quieras" : "Aún no se puede contratar. Por ahora puedes tener hasta 3 sucursales gratis.",
    monthlyPrice: 14990,
    description: "Para empresas con varios locales y equipos grandes.",
    audience: "Empresas con varias sucursales y más de 20 personas",
    maxBusinesses: 10,
    maxProducts: null,
    maxMembers: 1000, // en la práctica, sin límite
    features: ["inventory", "customers", "suppliers", "tools", "reports", "tips", "results", "exports", "cashClose", "cashflow", "cashflowPlus", "waste", "history", "fastScan", "balance", "comandas", "store", "agenda", "promos", "quotes", "loyalty", "multiUser", "branches"],
    highlights: [
      "Todo lo de Pro",
      "Trabajadores sin límite",
      "Hasta 10 sucursales",
      "Resumen de todas tus sucursales juntas",
      "Cuál sucursal vende más, de un vistazo",
      "Elige a qué sucursales entra cada trabajador",
    ],
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
 * `extra` = cupos regalados por el admin a ese negocio.
 */
export function memberLimit(plan: Plan, extra = 0) {
  return (PLANS_ENFORCED ? PLANS[plan].maxMembers : Math.max(PLANS[plan].maxMembers, PLANS.PRO.maxMembers)) + extra
}

/** Máximo de productos (null = sin límite) más los cupos extra del admin. Durante el lanzamiento no hay límite. */
export function productLimit(plan: Plan, extra = 0) {
  const base = PLANS_ENFORCED ? PLANS[plan].maxProducts : null
  return base === null ? null : base + extra
}

/** Negocios o sucursales que una persona puede tener como dueña. Durante el lanzamiento, como en Pro. */
export function businessLimit(plan: Plan) {
  return PLANS_ENFORCED ? PLANS[plan].maxBusinesses : Math.max(PLANS[plan].maxBusinesses, PLANS.PRO.maxBusinesses)
}

/** Plan elegido en la página de precios (?plan=pro | empresa), que se recuerda durante el registro. */
export type PlanChoice = "pro" | "empresa"
export function parsePlanChoice(value: unknown): PlanChoice | null {
  return value === "pro" || value === "empresa" ? value : null
}
export const PLAN_OF_CHOICE: Record<PlanChoice, PaidPlan> = { pro: "PRO", empresa: "BUSINESS" }
/** Dónde se paga el plan elegido. */
export function checkoutPath(choice: PlanChoice) {
  return `/dashboard/plan?plan=${choice}#contratar`
}
