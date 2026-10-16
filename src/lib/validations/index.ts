import { z } from "zod"
import { CURRENCY_CODES } from "@/lib/currency"
import { COUNTRIES } from "@/lib/constants"

// Mismos esquemas en el formulario (cliente) y en la Server Action (servidor).

const MAX_AMOUNT = 2_000_000_000

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : undefined))

export const money = z
  .number({ error: "Ingresa un monto" })
  .int("Monto inválido")
  .min(0, "No puede ser negativo")
  .max(MAX_AMOUNT, "Monto demasiado alto")

export const positiveMoney = money.refine((v) => v > 0, "Ingresa un monto mayor a 0")

export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")

export const paymentMethod = z.enum(["CASH", "DEBIT", "CREDIT", "TRANSFER", "OTHER", "FIADO"])
/** Métodos con los que entra plata de verdad (para abonos de fiado). */
export const cashPaymentMethod = z.enum(["CASH", "DEBIT", "CREDIT", "TRANSFER", "OTHER"])

const FIADO_NEEDS_CUSTOMER = {
  path: ["customerName"],
  message: "Para fiar, escribe el nombre del cliente",
}

// ─── Autenticación ──────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.email("Ingresa un correo válido").trim().toLowerCase(),
  password: z.string().min(1, "Ingresa tu contraseña"),
})

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.email("Ingresa un correo válido").trim().toLowerCase(),
  password: z.string().min(8, "Usa al menos 8 caracteres").max(128),
  marketingOptIn: z.boolean().default(false),
})

export const forgotPasswordSchema = z.object({
  email: z.email("Ingresa un correo válido").trim().toLowerCase(),
})

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Usa al menos 8 caracteres").max(128),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" })

// ─── Negocio ────────────────────────────────────────────────────────────────

const countryCode = z.enum(COUNTRIES.map((c) => c.code) as [string, ...string[]])
const currencyCode = z.enum(CURRENCY_CODES as [string, ...string[]])

export const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de tu negocio").max(80),
  type: optionalText(200),
  country: countryCode.default("CL"),
  currency: currencyCode.default("CLP"),
  hasProducts: z.boolean().nullable().optional(),
  hasEmployees: z.boolean().nullable().optional(),
  managesInventory: z.boolean().nullable().optional(),
  monthlyRevenueRange: optionalText(60),
})
export type OnboardingInput = z.input<typeof onboardingSchema>

export const businessSettingsSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de tu negocio").max(80),
  type: optionalText(200),
  country: countryCode,
  currency: currencyCode,
})
export type BusinessSettingsInput = z.input<typeof businessSettingsSchema>

export const preferencesSchema = z.object({
  easyMode: z.boolean().optional(),
  lowStockAlerts: z.boolean().optional(),
  noSalesReminder: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  chargesVat: z.boolean().optional(),
  vatDueDay: z.number().int().min(1).max(28).optional(),
  ppmRate: z.number().min(0).max(0.05).optional(),
  tableCount: z.number().int().min(0).max(200).optional(),
  tableExtras: z.array(z.string().trim().min(1).max(30, "Máximo 30 caracteres")).max(30, "Máximo 30 lugares").optional(),
})
export type PreferencesInput = z.input<typeof preferencesSchema>

export const categoryNameSchema = z.object({
  name: z.string().trim().min(2, "Escribe un nombre").max(40),
})

// ─── Ventas ─────────────────────────────────────────────────────────────────

export const saleItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().trim().min(1, "Escribe qué vendiste").max(120),
  quantity: z.number().int("Usa números enteros").min(1, "Mínimo 1").max(100_000),
  unitPrice: positiveMoney,
})

export const saleSchema = z
  .object({
    items: z.array(saleItemSchema).min(1, "Agrega al menos un producto o servicio").max(50),
    date: dateKey,
    paymentMethod,
    customerName: optionalText(80),
    note: optionalText(200),
    /** Para ventas guardadas sin internet: evita duplicarlas al reintentar y conserva la hora real. */
    clientId: z.string().regex(/^[\w-]{8,64}$/).optional(),
    soldAt: z.iso.datetime().optional(),
  })
  .refine((d) => d.paymentMethod !== "FIADO" || Boolean(d.customerName), FIADO_NEEDS_CUSTOMER)
export type SaleInput = z.input<typeof saleSchema>

export const quickSaleSchema = z
  .object({
    amount: positiveMoney,
    date: dateKey,
    paymentMethod,
    customerName: optionalText(80),
    note: optionalText(200),
    /** Para ventas guardadas sin internet: evita duplicarlas al reintentar y conserva la hora real. */
    clientId: z.string().regex(/^[\w-]{8,64}$/).optional(),
    soldAt: z.iso.datetime().optional(),
  })
  .refine((d) => d.paymentMethod !== "FIADO" || Boolean(d.customerName), FIADO_NEEDS_CUSTOMER)
export type QuickSaleInput = z.input<typeof quickSaleSchema>

// ─── Gastos ─────────────────────────────────────────────────────────────────

export const expenseSchema = z.object({
  description: z.string().trim().min(2, "Describe el gasto").max(120),
  categoryId: z.string().optional(),
  amount: positiveMoney,
  date: dateKey,
  supplierName: optionalText(80),
  hasInvoice: z.boolean().optional(),
})
export type ExpenseInput = z.input<typeof expenseSchema>

// ─── Productos ──────────────────────────────────────────────────────────────

export const productSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(100),
  sku: optionalText(120),
  categoryName: optionalText(40),
  cost: money,
  price: positiveMoney,
  stock: z.number().int("Usa números enteros").min(0).max(10_000_000),
  minStock: z.number().int("Usa números enteros").min(0).max(10_000_000),
  trackStock: z.boolean(),
  active: z.boolean(),
  /** Próximo vencimiento (AAAA-MM-DD) o vacío. */
  expiresAt: z.union([dateKey, z.literal("")]).optional(),
  /** Todos sus códigos de barras (el primero queda como principal). */
  codes: z.array(z.string().trim().min(1).max(120)).max(30, "Máximo 30 códigos por producto").optional(),
})
export type ProductInput = z.input<typeof productSchema>

// ─── Herramientas ───────────────────────────────────────────────────────────

export const goalSchema = z.object({
  targetProfit: positiveMoney,
  marginPct: z.number().min(1).max(100),
  fixedCosts: money,
})
export type GoalInput = z.input<typeof goalSchema>

export const idSchema = z.string().min(1).max(64)

// ─── Inventario ─────────────────────────────────────────────────────────────

export const inventoryMovementSchema = z.object({
  productId: z.string().min(1, "Elige un producto"),
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "WASTE"]),
  /** Entrada/salida: unidades que entran o salen. Ajuste: unidades contadas en total. */
  quantity: z.number().int("Usa números enteros").min(0).max(10_000_000),
  reason: optionalText(120),
})
export type InventoryMovementInput = z.input<typeof inventoryMovementSchema>

// ─── Pagos pendientes a proveedores ─────────────────────────────────────────

// ─── Retiros del dueño, préstamos y balance ────────────────────────────────

export const withdrawalSchema = z
  .object({
    kind: z.enum(["MONEY", "GOODS", "DEPOSIT"]),
    amount: money.optional(),
    date: dateKey,
    source: z.enum(["CASH", "BANK"]).default("CASH"),
    productId: z.string().max(60).optional(),
    quantity: z.number().int().min(1, "Al menos 1 unidad").max(100_000).optional(),
    note: optionalText(200),
  })
  .refine((v) => (v.kind === "GOODS" ? Boolean(v.productId && v.quantity) : (v.amount ?? 0) > 0), {
    message: "Completa el monto o el producto y la cantidad",
    path: ["amount"],
  })
export type WithdrawalInput = z.input<typeof withdrawalSchema>

export const loanSchema = z.object({
  lender: z.string().trim().min(2, "¿A quién le debes?").max(80),
  /** Al anotar un préstamo nuevo: si la plata entró recién, a la caja o al banco. */
  receivedTo: z.enum(["CASH", "BANK"]).optional(),
  balance: money,
  installment: money.optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  note: optionalText(200),
})
export type LoanInput = z.input<typeof loanSchema>

export const balanceSettingsSchema = z.object({
  ownerSalary: money.nullable().optional(),
  openingCash: money.nullable().optional(),
})
export type BalanceSettingsInput = z.input<typeof balanceSettingsSchema>

export const payableSchema = z.object({
  description: z.string().trim().min(2, "Escribe qué tienes que pagar").max(120),
  supplierName: optionalText(80),
  amount: positiveMoney,
  dueDate: dateKey,
  /** Es una factura a nombre del negocio (su IVA se descuenta en el mes de la factura). */
  hasInvoice: z.boolean().optional(),
  /** Fecha de la factura (si no viene, hoy). */
  invoiceDate: dateKey.optional(),
})
export type PayableInput = z.input<typeof payableSchema>

// ─── Clientes y proveedores ─────────────────────────────────────────────────

const phone = optionalText(30)
const email = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => (v ? v.toLowerCase() : undefined))
  .refine((v) => !v || z.email().safeParse(v).success, "Correo inválido")

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(80),
  phone,
  email,
  notes: optionalText(300),
})
export type CustomerInput = z.input<typeof customerSchema>

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(80),
  phone,
  email,
  products: optionalText(200),
  deliveryCost: money.optional(),
  notes: optionalText(300),
})
export type SupplierInput = z.input<typeof supplierSchema>

// ─── Fiado y caja ───────────────────────────────────────────────────────────

export const customerPaymentSchema = z.object({
  customerId: z.string().min(1),
  amount: positiveMoney,
  date: dateKey,
  paymentMethod: cashPaymentMethod,
  note: optionalText(200),
})
export type CustomerPaymentInput = z.input<typeof customerPaymentSchema>

export const cashClosingSchema = z.object({
  day: dateKey,
  opening: money,
  counted: money,
  /** Si los gastos del día se pagaron con el efectivo de la caja. */
  expensesFromCash: z.boolean(),
  note: optionalText(300),
})
export type CashClosingInput = z.input<typeof cashClosingSchema>

// ─── Comandas ───────────────────────────────────────────────────────────────

/** El id lo pone el celular: así cada plato conserva lo que la cocina ya marcó como listo. */
export const comandaItemSchema = saleItemSchema.extend({ id: z.string().regex(/^[\w-]{8,40}$/), note: optionalText(80) })

export const comandaSchema = z.object({
  label: z.string().trim().min(1, "Ponle un nombre: mesa, cliente o pedido").max(40, "Máximo 40 caracteres"),
  items: z.array(comandaItemSchema).max(50, "Máximo 50 productos por comanda"),
})
export type ComandaInput = z.input<typeof comandaSchema>

export const comandaChargeSchema = z
  .object({ paymentMethod, customerName: optionalText(80) })
  .refine((d) => d.paymentMethod !== "FIADO" || Boolean(d.customerName), FIADO_NEEDS_CUSTOMER)
export type ComandaChargeInput = z.input<typeof comandaChargeSchema>
