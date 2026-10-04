import type { PaymentMethod } from "@/generated/prisma/enums"

export const APP_NAME = "OrdenSimple"

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Efectivo" },
  { value: "DEBIT", label: "Débito" },
  { value: "CREDIT", label: "Crédito" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "OTHER", label: "Otro" },
  { value: "FIADO", label: "Fiado" },
]

export const PAYMENT_LABEL: Record<PaymentMethod, string> = Object.fromEntries(
  PAYMENT_METHODS.map((p) => [p.value, p.label]),
) as Record<PaymentMethod, string>

export const DEFAULT_EXPENSE_CATEGORIES: { name: string; icon: string; isVariable?: boolean }[] = [
  { name: "Arriendo", icon: "home" },
  { name: "Luz", icon: "zap" },
  { name: "Agua", icon: "droplet" },
  { name: "Internet", icon: "wifi" },
  { name: "Sueldos", icon: "users" },
  { name: "Publicidad", icon: "megaphone" },
  { name: "Transporte", icon: "truck" },
  { name: "Proveedores", icon: "package", isVariable: true },
  { name: "Impuestos", icon: "landmark" },
  { name: "Otros", icon: "ellipsis" },
]

export const BUSINESS_TYPES = [
  "Almacén o minimarket",
  "Restaurante, café o comida",
  "Tienda de ropa o accesorios",
  "Belleza y estética",
  "Servicios profesionales",
  "Tienda online",
  "Ferretería o construcción",
  "Taller o reparaciones",
  "Otro",
]

export const COUNTRIES = [
  { code: "CL", name: "Chile", currency: "CLP", timezone: "America/Santiago" },
  { code: "PE", name: "Perú", currency: "PEN", timezone: "America/Lima" },
  { code: "AR", name: "Argentina", currency: "ARS", timezone: "America/Argentina/Buenos_Aires" },
  { code: "CO", name: "Colombia", currency: "COP", timezone: "America/Bogota" },
  { code: "MX", name: "México", currency: "MXN", timezone: "America/Mexico_City" },
  { code: "ES", name: "España", currency: "EUR", timezone: "Europe/Madrid" },
  { code: "US", name: "Estados Unidos", currency: "USD", timezone: "America/New_York" },
] as const

export const REVENUE_RANGES = [
  "Menos de $1.000.000",
  "$1.000.000 a $5.000.000",
  "$5.000.000 a $20.000.000",
  "Más de $20.000.000",
  "Prefiero no decirlo",
]
